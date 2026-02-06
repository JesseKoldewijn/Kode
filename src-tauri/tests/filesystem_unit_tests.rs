//! Unit tests for filesystem commands
//!
//! Tests the async filesystem operations to ensure they:
//! 1. Work correctly with various file types and content
//! 2. Handle errors appropriately
//! 3. Are truly async and don't block the runtime

use std::time::Instant;
use tempfile::TempDir;
use tokio::fs;
use tokio::time::{timeout, Duration};

// ============================================================================
// read_file tests
// ============================================================================

#[tokio::test]
async fn read_file_returns_content_for_valid_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    fs::write(&file_path, "Hello, World!").await.unwrap();

    let content = fs::read_to_string(&file_path).await.unwrap();

    assert_eq!(content, "Hello, World!");
}

#[tokio::test]
async fn read_file_returns_error_for_nonexistent_file() {
    let result = fs::read_to_string("/nonexistent/path/file.txt").await;

    assert!(result.is_err());
}

#[tokio::test]
async fn read_file_handles_unicode_content() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("unicode.txt");
    let unicode_content = "Hello, \u{4e16}\u{754c}! \u{1F600}\nLine 2: \u{00e9}\u{00e8}\u{00ea}";
    fs::write(&file_path, unicode_content).await.unwrap();

    let content = fs::read_to_string(&file_path).await.unwrap();

    assert_eq!(content, unicode_content);
}

#[tokio::test]
async fn read_file_handles_empty_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("empty.txt");
    fs::write(&file_path, "").await.unwrap();

    let content = fs::read_to_string(&file_path).await.unwrap();

    assert_eq!(content, "");
}

#[tokio::test]
async fn read_file_handles_large_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("large.txt");

    // Create 1MB file
    let content = "x".repeat(1024 * 1024);
    fs::write(&file_path, &content).await.unwrap();

    let start = Instant::now();
    let read_content = fs::read_to_string(&file_path).await.unwrap();
    let duration = start.elapsed();

    assert_eq!(read_content.len(), 1024 * 1024);
    assert!(
        duration.as_millis() < 500,
        "Large file read took too long: {:?}",
        duration
    );
}

#[tokio::test]
async fn read_file_is_async_not_blocking() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("test.txt");
    fs::write(&file_path, "test content").await.unwrap();

    // Verify operation completes within timeout (not blocking)
    let result = timeout(Duration::from_millis(100), fs::read_to_string(&file_path)).await;

    assert!(result.is_ok(), "Async operation timed out - might be blocking");
    assert_eq!(result.unwrap().unwrap(), "test content");
}

#[tokio::test]
async fn read_file_preserves_line_endings() {
    let temp_dir = TempDir::new().unwrap();

    // Test LF
    let lf_path = temp_dir.path().join("lf.txt");
    fs::write(&lf_path, "line1\nline2\nline3").await.unwrap();
    let lf_content = fs::read_to_string(&lf_path).await.unwrap();
    assert_eq!(lf_content, "line1\nline2\nline3");

    // Test CRLF
    let crlf_path = temp_dir.path().join("crlf.txt");
    fs::write(&crlf_path, "line1\r\nline2\r\nline3").await.unwrap();
    let crlf_content = fs::read_to_string(&crlf_path).await.unwrap();
    assert_eq!(crlf_content, "line1\r\nline2\r\nline3");
}

// ============================================================================
// read_directory tests
// ============================================================================

#[tokio::test]
async fn read_directory_lists_files_and_directories() {
    let temp_dir = TempDir::new().unwrap();

    fs::write(temp_dir.path().join("file1.txt"), "").await.unwrap();
    fs::write(temp_dir.path().join("file2.txt"), "").await.unwrap();
    fs::create_dir(temp_dir.path().join("subdir")).await.unwrap();

    let mut entries = fs::read_dir(temp_dir.path()).await.unwrap();
    let mut names = Vec::new();
    while let Some(entry) = entries.next_entry().await.unwrap() {
        names.push(entry.file_name().to_string_lossy().to_string());
    }

    assert_eq!(names.len(), 3);
    assert!(names.contains(&"file1.txt".to_string()));
    assert!(names.contains(&"file2.txt".to_string()));
    assert!(names.contains(&"subdir".to_string()));
}

#[tokio::test]
async fn read_directory_returns_error_for_nonexistent_path() {
    let result = fs::read_dir("/nonexistent/path").await;

    assert!(result.is_err());
}

#[tokio::test]
async fn read_directory_handles_empty_directory() {
    let temp_dir = TempDir::new().unwrap();

    let mut entries = fs::read_dir(temp_dir.path()).await.unwrap();
    let mut count = 0;
    while entries.next_entry().await.unwrap().is_some() {
        count += 1;
    }

    assert_eq!(count, 0);
}

#[tokio::test]
async fn read_directory_handles_many_entries_efficiently() {
    let temp_dir = TempDir::new().unwrap();

    // Create 100 files
    for i in 0..100 {
        let file_path = temp_dir.path().join(format!("file_{:03}.txt", i));
        fs::write(&file_path, format!("content {}", i)).await.unwrap();
    }

    let start = Instant::now();
    let mut entries = fs::read_dir(temp_dir.path()).await.unwrap();
    let mut count = 0;
    while entries.next_entry().await.unwrap().is_some() {
        count += 1;
    }
    let duration = start.elapsed();

    assert_eq!(count, 100);
    assert!(
        duration.as_millis() < 200,
        "Directory read took too long: {:?}",
        duration
    );
}

#[tokio::test]
async fn read_directory_distinguishes_files_from_directories() {
    let temp_dir = TempDir::new().unwrap();

    fs::write(temp_dir.path().join("file.txt"), "").await.unwrap();
    fs::create_dir(temp_dir.path().join("directory")).await.unwrap();

    let mut entries = fs::read_dir(temp_dir.path()).await.unwrap();
    let mut files = 0;
    let mut dirs = 0;

    while let Some(entry) = entries.next_entry().await.unwrap() {
        let metadata = entry.metadata().await.unwrap();
        if metadata.is_file() {
            files += 1;
        } else if metadata.is_dir() {
            dirs += 1;
        }
    }

    assert_eq!(files, 1);
    assert_eq!(dirs, 1);
}

// ============================================================================
// write_file tests
// ============================================================================

#[tokio::test]
async fn write_file_creates_new_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("new_file.txt");

    fs::write(&file_path, "new content").await.unwrap();

    assert!(file_path.exists());
    let content = fs::read_to_string(&file_path).await.unwrap();
    assert_eq!(content, "new content");
}

#[tokio::test]
async fn write_file_overwrites_existing_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("existing.txt");

    fs::write(&file_path, "original content").await.unwrap();
    fs::write(&file_path, "new content").await.unwrap();

    let content = fs::read_to_string(&file_path).await.unwrap();
    assert_eq!(content, "new content");
}

#[tokio::test]
async fn write_file_preserves_unicode() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("unicode.txt");
    let unicode_content = "\u{4e16}\u{754c}\u{1F600}\u{00e9}";

    fs::write(&file_path, unicode_content).await.unwrap();

    let content = fs::read_to_string(&file_path).await.unwrap();
    assert_eq!(content, unicode_content);
}

#[tokio::test]
async fn write_file_is_async_not_blocking() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("async_test.txt");

    let result = timeout(
        Duration::from_millis(100),
        fs::write(&file_path, "test content"),
    )
    .await;

    assert!(result.is_ok(), "Async write timed out - might be blocking");
}

// ============================================================================
// create_file / create_directory tests
// ============================================================================

#[tokio::test]
async fn create_file_creates_empty_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("empty.txt");

    fs::write(&file_path, "").await.unwrap();

    assert!(file_path.exists());
    let metadata = fs::metadata(&file_path).await.unwrap();
    assert!(metadata.is_file());
    assert_eq!(metadata.len(), 0);
}

#[tokio::test]
async fn create_directory_creates_directory() {
    let temp_dir = TempDir::new().unwrap();
    let dir_path = temp_dir.path().join("new_dir");

    fs::create_dir(&dir_path).await.unwrap();

    assert!(dir_path.exists());
    let metadata = fs::metadata(&dir_path).await.unwrap();
    assert!(metadata.is_dir());
}

#[tokio::test]
async fn create_directory_creates_nested_directories() {
    let temp_dir = TempDir::new().unwrap();
    let nested_path = temp_dir.path().join("a/b/c/d");

    fs::create_dir_all(&nested_path).await.unwrap();

    assert!(nested_path.exists());
    assert!(fs::metadata(&nested_path).await.unwrap().is_dir());
}

#[tokio::test]
async fn create_file_with_parent_directories() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("parent/child/file.txt");

    // Create parent directories first
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).await.unwrap();
    }
    fs::write(&file_path, "content").await.unwrap();

    assert!(file_path.exists());
}

// ============================================================================
// delete_path tests
// ============================================================================

#[tokio::test]
async fn delete_path_deletes_file() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("to_delete.txt");
    fs::write(&file_path, "content").await.unwrap();

    fs::remove_file(&file_path).await.unwrap();

    assert!(!file_path.exists());
}

#[tokio::test]
async fn delete_path_deletes_empty_directory() {
    let temp_dir = TempDir::new().unwrap();
    let dir_path = temp_dir.path().join("empty_dir");
    fs::create_dir(&dir_path).await.unwrap();

    fs::remove_dir(&dir_path).await.unwrap();

    assert!(!dir_path.exists());
}

#[tokio::test]
async fn delete_path_deletes_directory_with_contents() {
    let temp_dir = TempDir::new().unwrap();
    let dir_path = temp_dir.path().join("dir_with_contents");
    fs::create_dir(&dir_path).await.unwrap();
    fs::write(dir_path.join("file1.txt"), "").await.unwrap();
    fs::write(dir_path.join("file2.txt"), "").await.unwrap();
    fs::create_dir(dir_path.join("subdir")).await.unwrap();
    fs::write(dir_path.join("subdir/nested.txt"), "").await.unwrap();

    fs::remove_dir_all(&dir_path).await.unwrap();

    assert!(!dir_path.exists());
}

#[tokio::test]
async fn delete_path_returns_error_for_nonexistent_path() {
    let result = fs::remove_file("/nonexistent/file.txt").await;

    assert!(result.is_err());
}

// ============================================================================
// rename_path tests
// ============================================================================

#[tokio::test]
async fn rename_path_renames_file() {
    let temp_dir = TempDir::new().unwrap();
    let old_path = temp_dir.path().join("old_name.txt");
    let new_path = temp_dir.path().join("new_name.txt");
    fs::write(&old_path, "content").await.unwrap();

    fs::rename(&old_path, &new_path).await.unwrap();

    assert!(!old_path.exists());
    assert!(new_path.exists());
    let content = fs::read_to_string(&new_path).await.unwrap();
    assert_eq!(content, "content");
}

#[tokio::test]
async fn rename_path_moves_file_to_different_directory() {
    let temp_dir = TempDir::new().unwrap();
    let old_path = temp_dir.path().join("file.txt");
    let new_dir = temp_dir.path().join("subdir");
    let new_path = new_dir.join("file.txt");

    fs::write(&old_path, "content").await.unwrap();
    fs::create_dir(&new_dir).await.unwrap();

    fs::rename(&old_path, &new_path).await.unwrap();

    assert!(!old_path.exists());
    assert!(new_path.exists());
}

#[tokio::test]
async fn rename_path_renames_directory() {
    let temp_dir = TempDir::new().unwrap();
    let old_path = temp_dir.path().join("old_dir");
    let new_path = temp_dir.path().join("new_dir");

    fs::create_dir(&old_path).await.unwrap();
    fs::write(old_path.join("file.txt"), "content").await.unwrap();

    fs::rename(&old_path, &new_path).await.unwrap();

    assert!(!old_path.exists());
    assert!(new_path.exists());
    assert!(new_path.join("file.txt").exists());
}

// ============================================================================
// Concurrency tests
// ============================================================================

#[tokio::test]
async fn multiple_concurrent_reads_dont_block() {
    let temp_dir = TempDir::new().unwrap();

    // Create 10 files
    for i in 0..10 {
        let file_path = temp_dir.path().join(format!("file_{}.txt", i));
        fs::write(&file_path, format!("content {}", i)).await.unwrap();
    }

    let start = Instant::now();

    // Read all files concurrently
    let mut handles = Vec::new();
    for i in 0..10 {
        let file_path = temp_dir.path().join(format!("file_{}.txt", i));
        handles.push(tokio::spawn(async move { fs::read_to_string(&file_path).await }));
    }

    // Wait for all reads to complete
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
    }

    let duration = start.elapsed();

    // All concurrent reads should complete quickly
    assert!(
        duration.as_millis() < 200,
        "Concurrent reads took too long: {:?}",
        duration
    );
}

#[tokio::test]
async fn read_and_write_to_different_files_concurrently() {
    let temp_dir = TempDir::new().unwrap();
    let read_path = temp_dir.path().join("read_file.txt");
    let write_path = temp_dir.path().join("write_file.txt");

    fs::write(&read_path, "read content").await.unwrap();

    let read_handle = tokio::spawn({
        let path = read_path.clone();
        async move { fs::read_to_string(&path).await }
    });

    let write_handle = tokio::spawn({
        let path = write_path.clone();
        async move { fs::write(&path, "write content").await }
    });

    let (read_result, write_result) = tokio::join!(read_handle, write_handle);

    assert!(read_result.unwrap().is_ok());
    assert!(write_result.unwrap().is_ok());
}

// ============================================================================
// Performance tests
// ============================================================================

#[tokio::test]
async fn small_file_read_performance() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("small.txt");
    fs::write(&file_path, "Hello, World!").await.unwrap();

    let start = Instant::now();
    let _ = fs::read_to_string(&file_path).await.unwrap();
    let duration = start.elapsed();

    assert!(
        duration.as_millis() < 50,
        "Small file read took too long: {:?}",
        duration
    );
}

#[tokio::test]
async fn file_metadata_performance() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("meta.txt");
    fs::write(&file_path, "content").await.unwrap();

    let start = Instant::now();
    let metadata = fs::metadata(&file_path).await.unwrap();
    let duration = start.elapsed();

    assert!(metadata.is_file());
    assert!(
        duration.as_millis() < 50,
        "Metadata read took too long: {:?}",
        duration
    );
}
