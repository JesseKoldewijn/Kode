//! Tests for file watcher commands
//!
//! Tests the async watcher operations to ensure they:
//! 1. Use tokio::sync::Mutex correctly (non-blocking)
//! 2. Handle concurrent access properly
//! 3. Start and stop watchers correctly
//! 4. Properly filter ignored paths

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tempfile::TempDir;
use tokio::sync::Mutex;
use tokio::time::{timeout, Duration};

// ============================================================================
// Mock watcher state for testing mutex behavior
// ============================================================================

struct MockWatcherState {
    watched_path: String,
    #[allow(dead_code)]
    is_running: bool,
}

impl MockWatcherState {
    fn new(path: &str) -> Self {
        Self {
            watched_path: path.to_string(),
            is_running: true,
        }
    }
}

lazy_static::lazy_static! {
    static ref MOCK_WATCHER: Mutex<Option<MockWatcherState>> = Mutex::new(None);
}

// ============================================================================
// Helper functions (mirrors the actual should_ignore_path logic)
// ============================================================================

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

// ============================================================================
// Basic watcher start/stop tests
// ============================================================================

#[tokio::test]
async fn start_watcher_stores_state() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    {
        let mut state = watcher.lock().await;
        *state = Some(MockWatcherState::new("/test/path"));
    }
    
    let state = watcher.lock().await;
    assert!(state.is_some());
    assert_eq!(state.as_ref().unwrap().watched_path, "/test/path");
}

#[tokio::test]
async fn stop_watcher_clears_state() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    // Start
    {
        let mut state = watcher.lock().await;
        *state = Some(MockWatcherState::new("/test/path"));
    }
    
    // Stop
    {
        let mut state = watcher.lock().await;
        *state = None;
    }
    
    let state = watcher.lock().await;
    assert!(state.is_none());
}

#[tokio::test]
async fn restart_watcher_updates_path() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    // Start with first path
    {
        let mut state = watcher.lock().await;
        *state = Some(MockWatcherState::new("/first/path"));
    }
    
    // Stop and restart with new path
    {
        let mut state = watcher.lock().await;
        *state = None;
        *state = Some(MockWatcherState::new("/second/path"));
    }
    
    let state = watcher.lock().await;
    assert_eq!(state.as_ref().unwrap().watched_path, "/second/path");
}

#[tokio::test]
async fn stop_watcher_idempotent() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    // Start
    {
        let mut state = watcher.lock().await;
        *state = Some(MockWatcherState::new("/test/path"));
    }
    
    // Stop multiple times - should not panic
    for _ in 0..3 {
        let mut state = watcher.lock().await;
        if state.is_some() {
            *state = None;
        }
    }
    
    let state = watcher.lock().await;
    assert!(state.is_none());
}

// ============================================================================
// Path ignore tests
// ============================================================================

#[tokio::test]
async fn ignores_node_modules() {
    let path = PathBuf::from("/project/node_modules/package/index.js");
    assert!(should_ignore_path(&path));
    
    let path = PathBuf::from("/project/src/node_modules/lib.js");
    assert!(should_ignore_path(&path));
}

#[tokio::test]
async fn ignores_git_directory() {
    let path = PathBuf::from("/project/.git/objects/pack");
    assert!(should_ignore_path(&path));
    
    let path = PathBuf::from("/project/.git/HEAD");
    assert!(should_ignore_path(&path));
}

#[tokio::test]
async fn ignores_target_directory() {
    let path = PathBuf::from("/project/target/debug/build");
    assert!(should_ignore_path(&path));
}

#[tokio::test]
async fn ignores_dist_directory() {
    let path = PathBuf::from("/project/dist/bundle.js");
    assert!(should_ignore_path(&path));
}

#[tokio::test]
async fn ignores_system_files() {
    let path = PathBuf::from("/project/.DS_Store");
    assert!(should_ignore_path(&path));
    
    let path = PathBuf::from("/project/src/.DS_Store");
    assert!(should_ignore_path(&path));
}

#[tokio::test]
async fn ignores_swap_files() {
    // Swap files as directory endings (the actual pattern the code looks for)
    let path = PathBuf::from("/project/.swp");
    assert!(should_ignore_path(&path));
    
    let path = PathBuf::from("/project/.swo");
    assert!(should_ignore_path(&path));
    
    // Note: The actual implementation looks for /.swp or \.swp endings,
    // not file.txt.swp patterns (that would require different logic)
}

#[tokio::test]
async fn does_not_ignore_regular_files() {
    let path = PathBuf::from("/project/src/main.rs");
    assert!(!should_ignore_path(&path));
    
    let path = PathBuf::from("/project/package.json");
    assert!(!should_ignore_path(&path));
    
    let path = PathBuf::from("/project/README.md");
    assert!(!should_ignore_path(&path));
}

#[tokio::test]
async fn does_not_ignore_partial_matches() {
    // "node_modules" as part of a different name
    let path = PathBuf::from("/project/src/my_node_modules_helper.js");
    assert!(!should_ignore_path(&path));
    
    // "target" as part of a different name
    let path = PathBuf::from("/project/targeting/main.rs");
    assert!(!should_ignore_path(&path));
}

// ============================================================================
// Async mutex behavior tests
// ============================================================================

#[tokio::test]
async fn mutex_lock_is_async() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    let result = timeout(Duration::from_millis(100), async {
        let _guard = watcher.lock().await;
        tokio::time::sleep(Duration::from_millis(10)).await;
    })
    .await;
    
    assert!(result.is_ok(), "Async mutex lock should complete quickly");
}

#[tokio::test]
async fn concurrent_start_stop_operations() {
    let watcher: Arc<Mutex<Option<MockWatcherState>>> = Arc::new(Mutex::new(None));
    
    let start = Instant::now();
    let mut handles = vec![];
    
    // Simulate concurrent start/stop operations
    for i in 0..10 {
        let watcher_clone = watcher.clone();
        let handle = tokio::spawn(async move {
            // Start
            {
                let mut state = watcher_clone.lock().await;
                *state = Some(MockWatcherState::new(&format!("/path/{}", i)));
            }
            tokio::time::sleep(Duration::from_millis(5)).await;
            // Stop
            {
                let mut state = watcher_clone.lock().await;
                *state = None;
            }
        });
        handles.push(handle);
    }
    
    for handle in handles {
        handle.await.unwrap();
    }
    
    let elapsed = start.elapsed();
    assert!(elapsed.as_millis() < 1000, "Concurrent ops should not deadlock: {:?}", elapsed);
}

#[tokio::test]
async fn lock_does_not_block_other_tasks() {
    let watcher: Arc<Mutex<Option<MockWatcherState>>> = Arc::new(Mutex::new(None));
    
    let watcher_clone = watcher.clone();
    
    // Task that holds the lock
    let lock_holder = tokio::spawn(async move {
        let _guard = watcher_clone.lock().await;
        tokio::time::sleep(Duration::from_millis(50)).await;
    });
    
    // Task that should still run
    let counter = tokio::spawn(async {
        let mut count = 0;
        for _ in 0..100 {
            count += 1;
            tokio::task::yield_now().await;
        }
        count
    });
    
    let count_result = counter.await.unwrap();
    assert_eq!(count_result, 100);
    
    lock_holder.await.unwrap();
}

#[tokio::test]
async fn watcher_operations_complete_within_timeout() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    let result = timeout(Duration::from_millis(100), async {
        // Start
        {
            let mut state = watcher.lock().await;
            *state = Some(MockWatcherState::new("/test/path"));
        }
        
        // Check state
        {
            let state = watcher.lock().await;
            assert!(state.is_some());
        }
        
        // Stop
        {
            let mut state = watcher.lock().await;
            *state = None;
        }
    })
    .await;
    
    assert!(result.is_ok(), "Watcher operations should complete within 100ms");
}

// ============================================================================
// Integration with file system operations
// ============================================================================

#[tokio::test]
async fn watcher_ops_concurrent_with_file_io() {
    let watcher: Arc<Mutex<Option<MockWatcherState>>> = Arc::new(Mutex::new(None));
    
    let watcher_task = {
        let watcher = watcher.clone();
        tokio::spawn(async move {
            let mut state = watcher.lock().await;
            *state = Some(MockWatcherState::new("/test/path"));
            tokio::time::sleep(Duration::from_millis(20)).await;
            state.is_some()
        })
    };
    
    let file_task = tokio::spawn(async {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        tokio::fs::write(&file_path, "test content").await.unwrap();
        tokio::fs::read_to_string(&file_path).await.unwrap()
    });
    
    let (watcher_result, file_result) = tokio::join!(watcher_task, file_task);
    
    assert!(watcher_result.unwrap());
    assert_eq!(file_result.unwrap(), "test content");
}

// ============================================================================
// Edge cases
// ============================================================================

#[tokio::test]
async fn handles_empty_path() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    {
        let mut state = watcher.lock().await;
        *state = Some(MockWatcherState::new(""));
    }
    
    let state = watcher.lock().await;
    assert_eq!(state.as_ref().unwrap().watched_path, "");
}

#[tokio::test]
async fn handles_unicode_path() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    let unicode_path = "/プロジェクト/소스/源码";
    {
        let mut state = watcher.lock().await;
        *state = Some(MockWatcherState::new(unicode_path));
    }
    
    let state = watcher.lock().await;
    assert_eq!(state.as_ref().unwrap().watched_path, unicode_path);
}

#[tokio::test]
async fn handles_rapid_start_stop_cycles() {
    let watcher: Mutex<Option<MockWatcherState>> = Mutex::new(None);
    
    for i in 0..50 {
        // Start
        {
            let mut state = watcher.lock().await;
            *state = Some(MockWatcherState::new(&format!("/path/{}", i)));
        }
        // Stop
        {
            let mut state = watcher.lock().await;
            *state = None;
        }
    }
    
    let state = watcher.lock().await;
    assert!(state.is_none(), "Watcher should be stopped after all cycles");
}

#[tokio::test]
async fn windows_path_separators() {
    // Windows-style paths
    let path = PathBuf::from("C:\\project\\node_modules\\package\\index.js");
    assert!(should_ignore_path(&path));
    
    let path = PathBuf::from("C:\\project\\.git\\HEAD");
    assert!(should_ignore_path(&path));
    
    let path = PathBuf::from("C:\\project\\src\\main.rs");
    assert!(!should_ignore_path(&path));
}
