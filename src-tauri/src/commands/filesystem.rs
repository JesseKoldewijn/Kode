use serde::{Deserialize, Serialize};
use std::path::Path;
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: Option<u64>,
    pub modified: Option<u64>,
    pub git_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub score: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentMatch {
    pub path: String,
    pub line_number: u32,
    pub line_content: String,
    pub match_start: u32,
    pub match_end: u32,
}

/// Read directory contents
#[tauri::command]
pub async fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let path_ref = Path::new(&path);
    
    // Async existence check
    if !tokio::fs::try_exists(path_ref).await.unwrap_or(false) {
        return Err(format!("Path does not exist: {}", path_ref.display()));
    }
    
    // Async metadata to check if directory
    let metadata = tokio::fs::metadata(path_ref)
        .await
        .map_err(|e| format!("Failed to read path metadata: {}", e))?;
    
    if !metadata.is_dir() {
        return Err(format!("Path is not a directory: {}", path_ref.display()));
    }
    
    let mut entries = Vec::new();
    let mut dir = tokio::fs::read_dir(path_ref).await.map_err(|e| e.to_string())?;
    
    while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
        let metadata = entry.metadata().await.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        
        entries.push(FileEntry {
            name,
            path: entry.path().to_string_lossy().to_string(),
            is_directory: metadata.is_dir(),
            is_symlink: metadata.is_symlink(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
            modified: metadata.modified().ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs()),
            git_status: None,
        });
    }
    
    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        match (a.is_directory, b.is_directory) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(entries)
}

/// Read file contents
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Write file contents
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a new file
#[tauri::command]
pub async fn create_file(path: String, content: Option<String>) -> Result<(), String> {
    let path_ref = Path::new(&path);
    
    if tokio::fs::try_exists(path_ref).await.unwrap_or(false) {
        return Err("File already exists".to_string());
    }
    
    // Create parent directories if needed
    if let Some(parent) = path_ref.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    tokio::fs::write(path_ref, content.unwrap_or_default())
        .await
        .map_err(|e| format!("Failed to create file: {}", e))
}

/// Create a new directory
#[tauri::command]
pub async fn create_directory(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))
}

/// Delete a file or directory
#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let path_ref = Path::new(&path);
    
    let metadata = tokio::fs::metadata(path_ref)
        .await
        .map_err(|_| "Path does not exist".to_string())?;
    
    if metadata.is_dir() {
        tokio::fs::remove_dir_all(path_ref)
            .await
            .map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        tokio::fs::remove_file(path_ref)
            .await
            .map_err(|e| format!("Failed to delete file: {}", e))
    }
}

/// Rename/move a file or directory
#[tauri::command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    tokio::fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| format!("Failed to rename: {}", e))
}

/// Search for files by name (fuzzy matching)
#[tauri::command]
pub async fn search_files(root: String, query: String, max_results: Option<usize>) -> Result<Vec<SearchResult>, String> {
    tokio::task::spawn_blocking(move || {
        let max_results = max_results.unwrap_or(50);
        let matcher = SkimMatcherV2::default();
        
        let mut results: Vec<SearchResult> = Vec::new();
        
        // Use ignore crate to respect .gitignore
        let walker = ignore::WalkBuilder::new(&root)
            .hidden(false)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build();
        
        for entry in walker {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            
            let path = entry.path();
            let name = match path.file_name() {
                Some(n) => n.to_string_lossy().to_string(),
                None => continue,
            };
            
            // Skip directories for file search
            if path.is_dir() {
                continue;
            }
            
            if let Some(score) = matcher.fuzzy_match(&name, &query) {
                results.push(SearchResult {
                    path: path.to_string_lossy().to_string(),
                    name,
                    score,
                });
            }
        }
        
        // Sort by score (descending)
        results.sort_by(|a, b| b.score.cmp(&a.score));
        results.truncate(max_results);
        
        Ok(results)
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?
}

/// Search for content in files (grep-like)
#[tauri::command]
pub async fn search_content(root: String, query: String, max_results: Option<usize>) -> Result<Vec<ContentMatch>, String> {
    tokio::task::spawn_blocking(move || {
        let max_results = max_results.unwrap_or(100);
        let mut results: Vec<ContentMatch> = Vec::new();
        
        // Use ignore crate to respect .gitignore
        let walker = ignore::WalkBuilder::new(&root)
            .hidden(false)
            .git_ignore(true)
            .git_global(true)
            .git_exclude(true)
            .build();
        
        for entry in walker {
            if results.len() >= max_results {
                break;
            }
            
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            
            let path = entry.path();
            
            // Skip directories and binary files
            if path.is_dir() {
                continue;
            }
            
            // Skip large files (> 1MB)
            if let Ok(metadata) = path.metadata() {
                if metadata.len() > 1_000_000 {
                    continue;
                }
            }
            
            // Read file content
            let content = match std::fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => continue, // Skip binary/unreadable files
            };
            
            // Search line by line
            for (line_num, line) in content.lines().enumerate() {
                if results.len() >= max_results {
                    break;
                }
                
                if let Some(match_start) = line.to_lowercase().find(&query.to_lowercase()) {
                    let match_end = match_start + query.len();
                    results.push(ContentMatch {
                        path: path.to_string_lossy().to_string(),
                        line_number: (line_num + 1) as u32,
                        line_content: line.to_string(),
                        match_start: match_start as u32,
                        match_end: match_end as u32,
                    });
                }
            }
        }
        
        Ok(results)
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?
}
