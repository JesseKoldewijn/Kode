use kode_lib::editor::buffer::MANAGER;
use kode_lib::editor::editing::{EditOperation, TextRange};
use std::time::Duration;
use tokio::time::timeout;

/// Test that opening a buffer doesn't block concurrent reads
#[tokio::test]
async fn test_open_buffer_concurrent_reads() {
    // Open initial buffer
    {
        let mut manager = MANAGER.write().await;
        manager.open("test1".to_string(), "initial content", None).unwrap();
    }
    
    // Spawn task that opens a new buffer
    let open_task = tokio::spawn(async {
        let content = "x".repeat(1000); // Small content
        let id = {
            let mut manager = MANAGER.write().await;
            manager.open("test2".to_string(), &content, None).unwrap()
        };
        id
    });
    
    // Spawn task that reads existing buffer (should not block)
    let read_task = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("test1") {
            let buffer = buffer_arc.read().await;
            Some(buffer.rope.to_string())
        } else {
            None
        }
    });
    
    // Both should complete within 500ms
    let result = timeout(Duration::from_millis(500), async {
        let _ = open_task.await;
        let content = read_task.await.unwrap();
        content
    }).await;
    
    assert!(result.is_ok(), "Concurrent read should not block on open");
    assert_eq!(result.unwrap(), Some("initial content".to_string()));
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("test1");
        manager.close("test2");
    }
}

/// Test that multiple concurrent reads don't block each other
#[tokio::test]
async fn test_concurrent_reads() {
    // Setup buffer
    {
        let mut manager = MANAGER.write().await;
        manager.open("concurrent".to_string(), "test content", None).unwrap();
    }
    
    // Spawn 10 concurrent read tasks
    let mut handles = vec![];
    for i in 0..10 {
        let handle = tokio::spawn(async move {
            let manager = MANAGER.read().await;
            let content = if let Some(buffer_arc) = manager.get("concurrent") {
                let buffer = buffer_arc.read().await;
                Some(buffer.rope.to_string())
            } else {
                None
            };
            (i, content)
        });
        handles.push(handle);
    }
    
    // All reads should complete quickly
    let result = timeout(Duration::from_millis(500), async {
        let mut results = vec![];
        for handle in handles {
            results.push(handle.await.unwrap());
        }
        results
    }).await;
    
    assert!(result.is_ok(), "Concurrent reads should not block");
    let results = result.unwrap();
    assert_eq!(results.len(), 10);
    
    for (i, content) in results {
        assert_eq!(content, Some("test content".to_string()), "Read {} failed", i);
    }
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("concurrent");
    }
}

/// Test that writes don't cause deadlocks with concurrent reads
#[tokio::test]
async fn test_write_with_concurrent_reads() {
    // Setup buffer
    {
        let mut manager = MANAGER.write().await;
        manager.open("write_test".to_string(), "initial", None).unwrap();
    }
    
    // Spawn write task
    let write_task = tokio::spawn(async {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("write_test") {
            let mut buffer = buffer_arc.write().await;
            kode_lib::editor::editing::apply_edit(&mut buffer, EditOperation {
                range: TextRange { start_line: 0, start_col: 7, end_line: 0, end_col: 7 },
                new_text: " modified".to_string(),
            });
        }
    });
    
    // Spawn read task that starts after write begins
    let read_task = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("write_test") {
            let buffer = buffer_arc.read().await;
            Some(buffer.rope.to_string())
        } else {
            None
        }
    });
    
    // Both should complete within 500ms
    let result = timeout(Duration::from_millis(500), async {
        write_task.await.unwrap();
        read_task.await.unwrap()
    }).await;
    
    assert!(result.is_ok(), "Read should not deadlock with write");
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("write_test");
    }
}

/// Test that lazy parsing doesn't hold write lock
#[tokio::test]
async fn test_lazy_parsing_no_deadlock() {
    // Setup JavaScript buffer (will need parsing for highlights)
    {
        let mut manager = MANAGER.write().await;
        manager.open(
            "parse_test.js".to_string(),
            "const x = 42;\nconst y = 100;",
            Some(std::path::PathBuf::from("/tmp/parse_test.js")),
        ).unwrap();
    }
    
    // Spawn task that triggers lazy parsing via parse_if_needed
    let parse_task = tokio::spawn(async {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("parse_test.js") {
            let mut buffer = buffer_arc.write().await;
            buffer.parse_if_needed();
        }
    });
    
    // Spawn concurrent read (should not block)
    let read_task = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("parse_test.js") {
            let buffer = buffer_arc.read().await;
            Some(buffer.rope.to_string())
        } else {
            None
        }
    });
    
    // Should complete within 1 second (parsing might take time but shouldn't deadlock)
    let result = timeout(Duration::from_secs(1), async {
        parse_task.await.unwrap();
        read_task.await.unwrap()
    }).await;
    
    assert!(result.is_ok(), "Lazy parsing should not cause deadlock");
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("parse_test.js");
    }
}

/// Test that multiple buffers can be edited concurrently
#[tokio::test]
async fn test_multiple_buffer_edits() {
    // Setup 3 buffers
    {
        let mut manager = MANAGER.write().await;
        manager.open("buf1".to_string(), "content 1", None).unwrap();
        manager.open("buf2".to_string(), "content 2", None).unwrap();
        manager.open("buf3".to_string(), "content 3", None).unwrap();
    }
    
    // Edit all 3 concurrently
    let edit1 = tokio::spawn(async {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("buf1") {
            let mut buffer = buffer_arc.write().await;
            kode_lib::editor::editing::apply_edit(&mut buffer, EditOperation {
                range: TextRange { start_line: 0, start_col: 9, end_line: 0, end_col: 9 },
                new_text: " edited".to_string(),
            });
        }
    });
    
    let edit2 = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(5)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("buf2") {
            let mut buffer = buffer_arc.write().await;
            kode_lib::editor::editing::apply_edit(&mut buffer, EditOperation {
                range: TextRange { start_line: 0, start_col: 9, end_line: 0, end_col: 9 },
                new_text: " edited".to_string(),
            });
        }
    });
    
    let edit3 = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("buf3") {
            let mut buffer = buffer_arc.write().await;
            kode_lib::editor::editing::apply_edit(&mut buffer, EditOperation {
                range: TextRange { start_line: 0, start_col: 9, end_line: 0, end_col: 9 },
                new_text: " edited".to_string(),
            });
        }
    });
    
    // All should complete within 500ms
    let result = timeout(Duration::from_millis(500), async {
        edit1.await.unwrap();
        edit2.await.unwrap();
        edit3.await.unwrap();
    }).await;
    
    assert!(result.is_ok(), "Multiple buffer edits should not deadlock");
    
    // Verify all edits applied
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("buf1") {
            let buffer = buffer_arc.read().await;
            assert_eq!(buffer.rope.to_string(), "content 1 edited");
        }
        if let Some(buffer_arc) = manager.get("buf2") {
            let buffer = buffer_arc.read().await;
            assert_eq!(buffer.rope.to_string(), "content 2 edited");
        }
        if let Some(buffer_arc) = manager.get("buf3") {
            let buffer = buffer_arc.read().await;
            assert_eq!(buffer.rope.to_string(), "content 3 edited");
        }
    }
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("buf1");
        manager.close("buf2");
        manager.close("buf3");
    }
}

/// Test that undo doesn't hold locks too long
#[tokio::test]
async fn test_undo_no_long_lock() {
    // Setup buffer with some edits
    {
        let mut manager = MANAGER.write().await;
        manager.open("undo_test".to_string(), "hello", None).unwrap();
    }
    
    // Apply edit
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("undo_test") {
            let mut buffer = buffer_arc.write().await;
            kode_lib::editor::editing::apply_edit(&mut buffer, EditOperation {
                range: TextRange { start_line: 0, start_col: 5, end_line: 0, end_col: 5 },
                new_text: " world".to_string(),
            });
            buffer.history.finalize_pending();
        }
    }
    
    // Perform undo
    let undo_task = tokio::spawn(async {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("undo_test") {
            let mut buffer = buffer_arc.write().await;
            if let Some(group) = buffer.history.undo() {
                for edit in group.edits.iter().rev() {
                    let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize) 
                        + edit.range.start_col as usize;
                    let end_byte = start_byte + edit.new_text.len();
                    buffer.rope.remove(start_byte..end_byte);
                    buffer.rope.insert(start_byte, &edit.old_text);
                }
                buffer.tree = None; // Invalidate tree, DON'T parse
            }
        }
    });
    
    // Concurrent read should not block
    let read_task = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(10)).await;
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("undo_test") {
            let buffer = buffer_arc.read().await;
            Some(buffer.version)
        } else {
            None
        }
    });
    
    // Should complete quickly
    let result = timeout(Duration::from_millis(500), async {
        undo_task.await.unwrap();
        read_task.await.unwrap()
    }).await;
    
    assert!(result.is_ok(), "Undo should not hold lock too long");
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("undo_test");
    }
}

/// Test stress: many rapid operations
#[tokio::test]
async fn test_stress_rapid_operations() {
    // Setup buffer with initial content (each task will append to end)
    {
        let mut manager = MANAGER.write().await;
        manager.open("stress".to_string(), "line1\n", None).unwrap();
    }
    
    // Spawn 50 rapid edits - each appends a new line at the end
    let mut handles = vec![];
    for i in 0..50 {
        let handle = tokio::spawn(async move {
            let manager = MANAGER.read().await;
            if let Some(buffer_arc) = manager.get("stress") {
                let mut buffer = buffer_arc.write().await;
                // Always append at the end of buffer (safe for concurrent edits)
                let len_lines = buffer.rope.len_lines();
                let last_line_len = buffer.rope.line(len_lines.saturating_sub(1)).len_chars();
                kode_lib::editor::editing::apply_edit(&mut buffer, EditOperation {
                    range: TextRange {
                        start_line: len_lines.saturating_sub(1) as u32,
                        start_col: last_line_len as u32,
                        end_line: len_lines.saturating_sub(1) as u32,
                        end_col: last_line_len as u32,
                    },
                    new_text: format!("line{}\n", i + 2),
                });
            }
        });
        handles.push(handle);
    }
    
    // All should complete within 2 seconds
    let result = timeout(Duration::from_secs(2), async {
        for handle in handles {
            handle.await.unwrap();
        }
    }).await;
    
    assert!(result.is_ok(), "Stress test should not timeout");
    
    // Verify buffer was modified (should have 51 lines now: initial + 50 edits)
    {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get("stress") {
            let buffer = buffer_arc.read().await;
            assert!(buffer.version > 0);
            // Buffer should have multiple lines now
            assert!(buffer.rope.len_lines() > 1);
        }
    }
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("stress");
    }
}

/// Test that buffer manager singleton works correctly across threads
#[tokio::test]
async fn test_singleton_across_threads() {
    let buffer_id = "singleton_test".to_string();
    
    // Create buffer in thread 1
    let id_clone = buffer_id.clone();
    let create_handle = tokio::spawn(async move {
        let mut manager = MANAGER.write().await;
        manager.open(id_clone.clone(), "thread 1", None).unwrap();
        id_clone
    });
    
    let id = create_handle.await.unwrap();
    
    // Read from thread 2
    let id_clone2 = id.clone();
    let read_handle = tokio::spawn(async move {
        let manager = MANAGER.read().await;
        if let Some(buffer_arc) = manager.get(&id_clone2) {
            let buffer = buffer_arc.read().await;
            Some(buffer.rope.to_string())
        } else {
            None
        }
    });
    
    let content = read_handle.await.unwrap();
    assert_eq!(content, Some("thread 1".to_string()));
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close(&id);
    }
}

/// Test that get_highlights doesn't block open_buffer (real-world scenario)
#[tokio::test]
async fn test_get_highlights_doesnt_block_open() {
    // This simulates the real bug: user opens file, get_highlights is immediately
    // called by React effect, then user tries to open another file
    
    // Open first file (JavaScript - needs parsing)
    let large_content = "const x = 42;\nconst y = 100;\n".repeat(100);
    {
        let mut manager = MANAGER.write().await;
        manager.open(
            "file1.js".to_string(),
            &large_content, // Large enough to make parsing take time
            Some(std::path::PathBuf::from("/tmp/file1.js")),
        ).unwrap();
    }
    
    // Immediately call get_highlights (this triggers parsing in background)
    let highlights_task = tokio::spawn(async {
        kode_lib::commands::editor::get_highlights("file1.js".to_string(), 0, 10).await
    });
    
    // Immediately try to open another file (should NOT block)
    let open_task = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(5)).await;
        let mut manager = MANAGER.write().await;
        manager.open("file2.txt".to_string(), "test content", None).unwrap()
    });
    
    // Both should complete within 500ms
    let result = timeout(Duration::from_millis(500), async {
        let _ = highlights_task.await;
        open_task.await.unwrap()
    }).await;
    
    assert!(result.is_ok(), "get_highlights should not block open_buffer");
    
    // Cleanup
    {
        let mut manager = MANAGER.write().await;
        manager.close("file1.js");
        manager.close("file2.txt");
    }
}
