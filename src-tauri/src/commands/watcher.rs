use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

// Global watcher state - use tokio::sync::Mutex for async-safe access
lazy_static::lazy_static! {
    static ref WATCHER: Mutex<Option<WatcherState>> = Mutex::new(None);
}

struct WatcherState {
    _watcher: RecommendedWatcher,
    watched_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileChangeEvent {
    /// The type of change: "create", "modify", "remove", "rename"
    pub kind: String,
    /// Affected file/directory paths
    pub paths: Vec<String>,
}

/// Convert a notify EventKind to a simple string
fn event_kind_to_string(kind: &EventKind) -> Option<&'static str> {
    match kind {
        EventKind::Create(_) => Some("create"),
        EventKind::Modify(_) => Some("modify"),
        EventKind::Remove(_) => Some("remove"),
        _ => None,
    }
}

/// Check if a path should be ignored (node_modules, .git, target, etc.)
fn should_ignore_path(path: &PathBuf) -> bool {
    let path_str = path.to_string_lossy();
    let ignored_segments = [
        "node_modules",
        ".git",
        "target",
        "dist",
        ".DS_Store",
        "Thumbs.db",
        ".swp",
        ".swo",
        "~",
    ];

    for segment in &ignored_segments {
        if path_str.contains(&format!("/{}/", segment))
            || path_str.contains(&format!("\\{}\\", segment))
            || path_str.ends_with(&format!("/{}", segment))
            || path_str.ends_with(&format!("\\{}", segment))
        {
            return true;
        }
    }

    false
}

/// Start watching a directory for file changes
#[tauri::command]
pub async fn start_watcher(app: AppHandle, path: String) -> Result<(), String> {
    // Stop any existing watcher first
    stop_watcher_internal().await?;

    let watch_path = PathBuf::from(&path);
    if !watch_path.exists() || !watch_path.is_dir() {
        return Err(format!("Invalid watch path: {}", path));
    }

    let app_handle = app.clone();

    // Create a debounced watcher
    let watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            match result {
                Ok(event) => {
                    let kind_str = match event_kind_to_string(&event.kind) {
                        Some(k) => k,
                        None => return, // Ignore access, other events
                    };

                    // Filter out ignored paths
                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .filter(|p| !should_ignore_path(p))
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();

                    if paths.is_empty() {
                        return;
                    }

                    let change_event = FileChangeEvent {
                        kind: kind_str.to_string(),
                        paths,
                    };

                    if let Err(e) = app_handle.emit("file-change", change_event) {
                        log::error!("Failed to emit file-change event: {}", e);
                    }
                }
                Err(e) => {
                    log::error!("File watcher error: {}", e);
                }
            }
        },
        Config::default()
            .with_poll_interval(Duration::from_secs(2)),
    )
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    // Start watching (recursive)
    let mut watcher = watcher;
    watcher
        .watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to start watching: {}", e))?;

    // Store the watcher state
    let mut state = WATCHER.lock().await;
    *state = Some(WatcherState {
        _watcher: watcher,
        watched_path: path.clone(),
    });

    log::info!("File watcher started for: {}", path);
    Ok(())
}

/// Stop the file watcher
#[tauri::command]
pub async fn stop_watcher() -> Result<(), String> {
    stop_watcher_internal().await
}

async fn stop_watcher_internal() -> Result<(), String> {
    let mut state = WATCHER.lock().await;
    if let Some(watcher_state) = state.take() {
        log::info!(
            "File watcher stopped for: {}",
            watcher_state.watched_path
        );
    }
    Ok(())
}
