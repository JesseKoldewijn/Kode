use kode_lib::commands::editor::{open_buffer, close_buffer, edit_buffer, undo_buffer, redo_buffer, get_history_state};
use kode_lib::editor::buffer::MANAGER;
use kode_lib::editor::editing::{EditOperation, TextRange};
use std::time::Duration;
use tempfile::NamedTempFile;
use tokio::time::timeout;
use std::io::Write;

/// Helper to create a temp file with content
fn create_temp_file(content: &str) -> NamedTempFile {
    let mut file = NamedTempFile::new().unwrap();
    file.write_all(content.as_bytes()).unwrap();
    file.flush().unwrap();
    file
}

/// Helper to cleanup buffer
async fn cleanup_buffer(buffer_id: &str) {
    let mut manager = MANAGER.write().await;
    manager.close(buffer_id);
}

#[tokio::test]
async fn test_open_buffer_command() {
    let temp_file = create_temp_file("Hello, World!");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let result = open_buffer(path.clone()).await;
    
    assert!(result.is_ok());
    let info = result.unwrap();
    assert_eq!(info.id, path);
    assert_eq!(info.line_count, 1);
    assert_eq!(info.char_count, 13);
    assert_eq!(info.version, 0);
    assert_eq!(info.is_dirty, false);
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_open_buffer_javascript() {
    let temp_file = create_temp_file("const x = 42;");
    let path = temp_file.path().with_extension("js").to_str().unwrap().to_string();
    
    // Rename file to have .js extension
    std::fs::rename(temp_file.path(), &path).unwrap();
    
    let result = open_buffer(path.clone()).await;
    
    assert!(result.is_ok());
    let info = result.unwrap();
    assert_eq!(info.language, "JavaScript");
    
    cleanup_buffer(&info.id).await;
    std::fs::remove_file(&path).ok();
}

#[tokio::test]
async fn test_close_buffer_command() {
    let temp_file = create_temp_file("test content");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Verify buffer exists
    {
        let manager = MANAGER.read().await;
        assert!(manager.get(&info.id).is_some());
    }
    
    // Close buffer
    let result = close_buffer(info.id.clone()).await;
    assert!(result.is_ok());
    
    // Verify buffer removed
    {
        let manager = MANAGER.read().await;
        assert!(manager.get(&info.id).is_none());
    }
}

#[tokio::test]
async fn test_edit_buffer_command() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Edit: append " world"
    let edit = EditOperation {
        range: TextRange {
            start_line: 0,
            start_col: 5,
            end_line: 0,
            end_col: 5,
        },
        new_text: " world".to_string(),
    };
    
    let result = edit_buffer(info.id.clone(), edit).await;
    
    assert!(result.is_ok());
    let edit_result = result.unwrap();
    assert_eq!(edit_result.version, 1);
    assert_eq!(edit_result.new_end.line, 0);
    assert_eq!(edit_result.new_end.col, 11);
    
    // Verify content changed
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let buffer = buffer_arc.read().await;
            assert_eq!(buffer.rope.to_string(), "hello world");
            assert_eq!(buffer.is_dirty, true);
        }
    }
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_undo_buffer_command() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Apply edit
    let edit = EditOperation {
        range: TextRange { start_line: 0, start_col: 5, end_line: 0, end_col: 5 },
        new_text: " world".to_string(),
    };
    edit_buffer(info.id.clone(), edit).await.unwrap();
    
    // Finalize history
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let mut buffer = buffer_arc.write().await;
            buffer.history.finalize_pending();
        }
    }
    
    // Undo
    let result = undo_buffer(info.id.clone()).await;
    
    assert!(result.is_ok());
    let undo_result = result.unwrap();
    assert!(undo_result.success);
    assert_eq!(undo_result.content, "hello");
    assert_eq!(undo_result.version, 2); // Version increments on undo
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_undo_buffer_no_history() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Undo with no edits
    let result = undo_buffer(info.id.clone()).await;
    
    assert!(result.is_ok());
    let undo_result = result.unwrap();
    assert!(!undo_result.success); // Should fail gracefully
    assert_eq!(undo_result.content, "hello"); // Content unchanged
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_redo_buffer_command() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Apply edit
    let edit = EditOperation {
        range: TextRange { start_line: 0, start_col: 5, end_line: 0, end_col: 5 },
        new_text: " world".to_string(),
    };
    edit_buffer(info.id.clone(), edit).await.unwrap();
    
    // Finalize and undo
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let mut buffer = buffer_arc.write().await;
            buffer.history.finalize_pending();
        }
    }
    undo_buffer(info.id.clone()).await.unwrap();
    
    // Redo
    let result = redo_buffer(info.id.clone()).await;
    
    assert!(result.is_ok());
    let redo_result = result.unwrap();
    assert!(redo_result.success);
    assert_eq!(redo_result.content, "hello world");
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_redo_buffer_no_redo_stack() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Redo with no undo history
    let result = redo_buffer(info.id.clone()).await;
    
    assert!(result.is_ok());
    let redo_result = result.unwrap();
    assert!(!redo_result.success); // Should fail gracefully
    assert_eq!(redo_result.content, "hello");
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_get_history_state_command() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Initial state: no undo/redo
    let state = get_history_state(info.id.clone()).await.unwrap();
    assert!(!state.can_undo);
    assert!(!state.can_redo);
    
    // Apply edit
    let edit = EditOperation {
        range: TextRange { start_line: 0, start_col: 5, end_line: 0, end_col: 5 },
        new_text: " world".to_string(),
    };
    edit_buffer(info.id.clone(), edit).await.unwrap();
    
    // Finalize
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let mut buffer = buffer_arc.write().await;
            buffer.history.finalize_pending();
        }
    }
    
    // After edit: can undo, can't redo
    let state = get_history_state(info.id.clone()).await.unwrap();
    assert!(state.can_undo);
    assert!(!state.can_redo);
    
    // After undo: can't undo, can redo
    undo_buffer(info.id.clone()).await.unwrap();
    let state = get_history_state(info.id.clone()).await.unwrap();
    assert!(!state.can_undo);
    assert!(state.can_redo);
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_multiple_edits_sequence() {
    let temp_file = create_temp_file("");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Edit 1: insert "a"
    edit_buffer(info.id.clone(), EditOperation {
        range: TextRange { start_line: 0, start_col: 0, end_line: 0, end_col: 0 },
        new_text: "a".to_string(),
    }).await.unwrap();
    
    // Edit 2: insert "b"
    edit_buffer(info.id.clone(), EditOperation {
        range: TextRange { start_line: 0, start_col: 1, end_line: 0, end_col: 1 },
        new_text: "b".to_string(),
    }).await.unwrap();
    
    // Edit 3: insert "c"
    edit_buffer(info.id.clone(), EditOperation {
        range: TextRange { start_line: 0, start_col: 2, end_line: 0, end_col: 2 },
        new_text: "c".to_string(),
    }).await.unwrap();
    
    // Verify final content
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let buffer = buffer_arc.read().await;
            assert_eq!(buffer.rope.to_string(), "abc");
            assert_eq!(buffer.version, 3);
        }
    }
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_open_buffer_doesnt_block() {
    // This test ensures open_buffer releases write lock quickly
    let temp_file1 = create_temp_file("file 1 content");
    let temp_file2 = create_temp_file("file 2 content");
    let path1 = temp_file1.path().to_str().unwrap().to_string();
    let path2 = temp_file2.path().to_str().unwrap().to_string();
    
    // Open file 1
    let open_task = tokio::spawn(async move {
        open_buffer(path1).await
    });
    
    // Immediately try to open file 2 (should not block)
    let concurrent_open = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(10)).await;
        open_buffer(path2).await
    });
    
    // Both should complete within 500ms
    let result = timeout(Duration::from_millis(500), async {
        let info1 = open_task.await.unwrap().unwrap();
        let info2 = concurrent_open.await.unwrap().unwrap();
        (info1, info2)
    }).await;
    
    assert!(result.is_ok(), "open_buffer should not block concurrent opens");
    let (info1, info2) = result.unwrap();
    
    cleanup_buffer(&info1.id).await;
    cleanup_buffer(&info2.id).await;
}

#[tokio::test]
async fn test_undo_doesnt_block_reads() {
    let temp_file = create_temp_file("hello");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Apply edit
    edit_buffer(info.id.clone(), EditOperation {
        range: TextRange { start_line: 0, start_col: 5, end_line: 0, end_col: 5 },
        new_text: " world".to_string(),
    }).await.unwrap();
    
    // Finalize
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let mut buffer = buffer_arc.write().await;
            buffer.history.finalize_pending();
        }
    }
    
    let buffer_id = info.id.clone();
    
    // Perform undo
    let undo_task = tokio::spawn(async move {
        undo_buffer(buffer_id).await
    });
    
    // Concurrent read should not block
    let read_task = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let buffer = buffer_arc.read().await;
            Some(buffer.version)
        } else {
            None
        }
    });
    
    // Should complete within 500ms
    let result = timeout(Duration::from_millis(500), async {
        undo_task.await.unwrap().unwrap();
        read_task.await.unwrap()
    }).await;
    
    assert!(result.is_ok(), "Undo should not block reads");
    
    cleanup_buffer(&path).await;
}

#[tokio::test]
async fn test_error_handling_buffer_not_found() {
    let result = edit_buffer("nonexistent".to_string(), EditOperation {
        range: TextRange { start_line: 0, start_col: 0, end_line: 0, end_col: 0 },
        new_text: "test".to_string(),
    }).await;
    
    assert!(result.is_err());
}

#[tokio::test]
async fn test_multiline_edit_command() {
    let temp_file = create_temp_file("line 1");
    let path = temp_file.path().to_str().unwrap().to_string();
    
    let info = open_buffer(path.clone()).await.unwrap();
    
    // Insert newline and line 2
    edit_buffer(info.id.clone(), EditOperation {
        range: TextRange { start_line: 0, start_col: 6, end_line: 0, end_col: 6 },
        new_text: "\nline 2".to_string(),
    }).await.unwrap();
    
    // Verify
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&info.id) {
            let buffer = buffer_arc.read().await;
            assert_eq!(buffer.rope.to_string(), "line 1\nline 2");
            assert_eq!(buffer.rope.len_lines(), 2);
        }
    }
    
    cleanup_buffer(&info.id).await;
}

#[tokio::test]
async fn test_open_buffer_large_file_async() {
    // Create a large file (5MB of text)
    let large_content = "a".repeat(5_000_000);
    let temp_file = create_temp_file(&large_content);
    let path = temp_file.path().to_str().unwrap().to_string();
    
    // Open the large file while also performing concurrent operations
    let open_task = tokio::spawn({
        let path = path.clone();
        async move {
            open_buffer(path).await
        }
    });
    
    // Simulate concurrent IPC calls that should not be blocked
    let concurrent_task = tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(10)).await;
        // Try to acquire read lock for unrelated operation - just check we can access it
        let _manager = MANAGER.read().await;
        true // Successfully acquired lock
    });
    
    // Both tasks should complete within reasonable time (2 seconds for 5MB file)
    let result = timeout(Duration::from_secs(2), async {
        let open_result = open_task.await.unwrap();
        let concurrent_result = concurrent_task.await.unwrap();
        (open_result, concurrent_result)
    }).await;
    
    assert!(result.is_ok(), "Large file open should not block runtime - async I/O should allow concurrent operations");
    let (open_result, concurrent_success) = result.unwrap();
    assert!(concurrent_success, "Concurrent task should complete successfully");
    
    assert!(open_result.is_ok());
    let info = open_result.unwrap();
    assert_eq!(info.char_count, 5_000_000);
    
    cleanup_buffer(&info.id).await;
}
