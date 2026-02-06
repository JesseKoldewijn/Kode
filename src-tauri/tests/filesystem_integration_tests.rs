//! Integration tests for filesystem commands
//!
//! Tests complete workflows and interactions between multiple filesystem operations

use std::time::Instant;
use tempfile::TempDir;
use tokio::fs;

// ============================================================================
// Full lifecycle tests
// ============================================================================

#[tokio::test]
async fn create_write_read_delete_flow() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("lifecycle.txt");

    // Create
    fs::write(&file_path, "").await.unwrap();
    assert!(file_path.exists());

    // Write
    fs::write(&file_path, "updated content").await.unwrap();

    // Read
    let content = fs::read_to_string(&file_path).await.unwrap();
    assert_eq!(content, "updated content");

    // Delete
    fs::remove_file(&file_path).await.unwrap();
    assert!(!file_path.exists());
}

#[tokio::test]
async fn directory_with_nested_files_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let project_dir = temp_dir.path().join("my_project");

    // Create project structure
    fs::create_dir_all(&project_dir).await.unwrap();
    fs::create_dir_all(project_dir.join("src")).await.unwrap();
    fs::create_dir_all(project_dir.join("tests")).await.unwrap();

    // Create files
    fs::write(project_dir.join("README.md"), "# My Project").await.unwrap();
    fs::write(project_dir.join("src/main.rs"), "fn main() {}").await.unwrap();
    fs::write(project_dir.join("src/lib.rs"), "pub mod utils;").await.unwrap();
    fs::write(project_dir.join("tests/test.rs"), "#[test] fn test() {}").await.unwrap();

    // Verify structure
    let mut entries = fs::read_dir(&project_dir).await.unwrap();
    let mut names = Vec::new();
    while let Some(entry) = entries.next_entry().await.unwrap() {
        names.push(entry.file_name().to_string_lossy().to_string());
    }

    assert!(names.contains(&"README.md".to_string()));
    assert!(names.contains(&"src".to_string()));
    assert!(names.contains(&"tests".to_string()));

    // Read nested file
    let main_content = fs::read_to_string(project_dir.join("src/main.rs")).await.unwrap();
    assert_eq!(main_content, "fn main() {}");

    // Rename a file
    fs::rename(
        project_dir.join("src/lib.rs"),
        project_dir.join("src/library.rs"),
    )
    .await
    .unwrap();
    assert!(!project_dir.join("src/lib.rs").exists());
    assert!(project_dir.join("src/library.rs").exists());

    // Delete the entire project
    fs::remove_dir_all(&project_dir).await.unwrap();
    assert!(!project_dir.exists());
}

#[tokio::test]
async fn write_and_read_roundtrip_preserves_content() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("roundtrip.txt");

    let original = "Hello, \u{4e16}\u{754c}! \u{1F600}\nLine 2\r\nLine 3\rLine 4";

    fs::write(&file_path, original).await.unwrap();
    let read_back = fs::read_to_string(&file_path).await.unwrap();

    assert_eq!(read_back, original);
}

// ============================================================================
// Concurrent operation tests
// ============================================================================

#[tokio::test]
async fn multiple_reads_do_not_block_each_other() {
    let temp_dir = TempDir::new().unwrap();

    // Create multiple files
    for i in 0..20 {
        let content = format!("Content for file {}", i);
        fs::write(temp_dir.path().join(format!("file_{}.txt", i)), &content)
            .await
            .unwrap();
    }

    let start = Instant::now();

    // Read all files concurrently
    let mut handles = Vec::new();
    for i in 0..20 {
        let path = temp_dir.path().join(format!("file_{}.txt", i));
        handles.push(tokio::spawn(async move {
            fs::read_to_string(&path).await
        }));
    }

    let mut results = Vec::new();
    for handle in handles {
        results.push(handle.await.unwrap().unwrap());
    }

    let duration = start.elapsed();

    // Verify all reads succeeded
    assert_eq!(results.len(), 20);
    for (i, content) in results.iter().enumerate() {
        assert_eq!(content, &format!("Content for file {}", i));
    }

    // Concurrent reads should be fast
    assert!(
        duration.as_millis() < 300,
        "Concurrent reads took too long: {:?}",
        duration
    );
}

#[tokio::test]
async fn interleaved_reads_and_writes() {
    let temp_dir = TempDir::new().unwrap();

    // Create initial files
    for i in 0..5 {
        fs::write(temp_dir.path().join(format!("file_{}.txt", i)), format!("initial {}", i))
            .await
            .unwrap();
    }

    // Perform interleaved reads and writes
    let mut read_handles = Vec::new();
    let mut write_handles = Vec::new();

    // Read operations
    for i in 0..5 {
        let path = temp_dir.path().join(format!("file_{}.txt", i));
        read_handles.push(tokio::spawn(async move {
            fs::read_to_string(&path).await
        }));
    }

    // Write operations to different files
    for i in 5..10 {
        let path = temp_dir.path().join(format!("file_{}.txt", i));
        write_handles.push(tokio::spawn(async move {
            fs::write(&path, format!("written {}", i)).await
        }));
    }

    // All read operations should complete without error
    for handle in read_handles {
        let _ = handle.await.unwrap().unwrap();
    }

    // All write operations should complete without error
    for handle in write_handles {
        handle.await.unwrap().unwrap();
    }

    // Verify written files
    for i in 5..10 {
        let content = fs::read_to_string(temp_dir.path().join(format!("file_{}.txt", i)))
            .await
            .unwrap();
        assert_eq!(content, format!("written {}", i));
    }
}

// ============================================================================
// Error handling integration tests
// ============================================================================

#[tokio::test]
async fn graceful_error_handling_for_missing_files() {
    let temp_dir = TempDir::new().unwrap();

    // Try to read a nonexistent file
    let read_result = fs::read_to_string(temp_dir.path().join("missing.txt")).await;
    assert!(read_result.is_err());

    // Try to delete a nonexistent file
    let delete_result = fs::remove_file(temp_dir.path().join("missing.txt")).await;
    assert!(delete_result.is_err());

    // Try to list a nonexistent directory
    let list_result = fs::read_dir(temp_dir.path().join("missing_dir")).await;
    assert!(list_result.is_err());
}

#[tokio::test]
async fn operations_on_deleted_path_fail_gracefully() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("to_delete.txt");

    // Create and delete
    fs::write(&file_path, "content").await.unwrap();
    fs::remove_file(&file_path).await.unwrap();

    // Subsequent operations should fail gracefully
    assert!(fs::read_to_string(&file_path).await.is_err());
    assert!(fs::remove_file(&file_path).await.is_err());
    assert!(fs::metadata(&file_path).await.is_err());
}

// ============================================================================
// Real-world scenario tests
// ============================================================================

#[tokio::test]
async fn simulate_file_editor_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let file_path = temp_dir.path().join("document.txt");

    // User creates a new file
    fs::write(&file_path, "").await.unwrap();

    // User types content (multiple saves)
    fs::write(&file_path, "Hello").await.unwrap();
    fs::write(&file_path, "Hello, World!").await.unwrap();
    fs::write(&file_path, "Hello, World!\nThis is my document.").await.unwrap();

    // User reads the file
    let content = fs::read_to_string(&file_path).await.unwrap();
    assert_eq!(content, "Hello, World!\nThis is my document.");

    // User renames the file
    let new_path = temp_dir.path().join("my_document.txt");
    fs::rename(&file_path, &new_path).await.unwrap();

    // File should be accessible at new path
    let content = fs::read_to_string(&new_path).await.unwrap();
    assert_eq!(content, "Hello, World!\nThis is my document.");
}

#[tokio::test]
async fn simulate_project_initialization() {
    let temp_dir = TempDir::new().unwrap();
    let project_root = temp_dir.path().join("new_project");

    // Create project structure
    let dirs = ["src", "tests", "docs", ".git"];
    for dir in dirs {
        fs::create_dir_all(project_root.join(dir)).await.unwrap();
    }

    // Create configuration files
    let configs = [
        ("package.json", r#"{"name": "new_project"}"#),
        ("README.md", "# New Project"),
        (".gitignore", "node_modules/\ntarget/"),
        ("src/index.ts", "export default {};"),
    ];

    for (path, content) in configs {
        fs::write(project_root.join(path), content).await.unwrap();
    }

    // Verify project structure
    assert!(project_root.join("src").is_dir());
    assert!(project_root.join("tests").is_dir());
    assert!(project_root.join("package.json").is_file());
    assert!(project_root.join("src/index.ts").is_file());

    // Read back a file
    let package_json = fs::read_to_string(project_root.join("package.json")).await.unwrap();
    assert!(package_json.contains("new_project"));
}
