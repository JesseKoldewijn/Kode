use kode_lib::editor::buffer::{Buffer, BufferManager};
use kode_lib::editor::editing::{apply_edit, EditOperation, TextRange};
use kode_lib::editor::languages::LanguageId;

#[test]
fn test_buffer_creation() {
    let buffer = Buffer::new("test.txt".to_string(), "hello world", None);

    assert_eq!(buffer.id, "test.txt");
    assert_eq!(buffer.rope.to_string(), "hello world");
    assert_eq!(buffer.version, 0);
    assert_eq!(buffer.is_dirty, false);
    assert_eq!(buffer.language, LanguageId::Plaintext);
    assert_eq!(buffer.rope.len_lines(), 1);
    assert_eq!(buffer.rope.len_chars(), 11);
}

#[test]
fn test_buffer_creation_javascript() {
    let buffer = Buffer::new(
        "test.js".to_string(),
        "const x = 42;",
        Some(std::path::PathBuf::from("/tmp/test.js")),
    );

    assert_eq!(buffer.language, LanguageId::JavaScript);
}

#[test]
fn test_buffer_creation_typescript() {
    let buffer = Buffer::new(
        "test.ts".to_string(),
        "const x: number = 42;",
        Some(std::path::PathBuf::from("/tmp/test.ts")),
    );

    assert_eq!(buffer.language, LanguageId::TypeScript);
}

#[test]
fn test_buffer_multiline() {
    let content = "line 1\nline 2\nline 3";
    let buffer = Buffer::new("multi.txt".to_string(), content, None);

    assert_eq!(buffer.rope.len_lines(), 3);
    assert_eq!(buffer.rope.line(0).to_string(), "line 1\n");
    assert_eq!(buffer.rope.line(1).to_string(), "line 2\n");
    assert_eq!(buffer.rope.line(2).to_string(), "line 3");
}

#[test]
fn test_buffer_simple_insert() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello", None);

    let edit = EditOperation {
        range: TextRange {
            start_line: 0,
            start_col: 5,
            end_line: 0,
            end_col: 5,
        },
        new_text: " world".to_string(),
    };

    let result = apply_edit(&mut buffer, edit);

    assert_eq!(buffer.rope.to_string(), "hello world");
    assert_eq!(result.version, 1);
    assert_eq!(buffer.version, 1);
    assert_eq!(buffer.is_dirty, true);
    assert_eq!(result.new_end.line, 0);
    assert_eq!(result.new_end.col, 11);
}

#[test]
fn test_buffer_simple_delete() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello world", None);

    let edit = EditOperation {
        range: TextRange {
            start_line: 0,
            start_col: 5,
            end_line: 0,
            end_col: 11,
        },
        new_text: String::new(),
    };

    let result = apply_edit(&mut buffer, edit);

    assert_eq!(buffer.rope.to_string(), "hello");
    assert_eq!(result.version, 1);
    assert_eq!(buffer.is_dirty, true);
}

#[test]
fn test_buffer_replace() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello world", None);

    let edit = EditOperation {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 5,
        },
        new_text: "goodbye".to_string(),
    };

    let result = apply_edit(&mut buffer, edit);

    assert_eq!(buffer.rope.to_string(), "goodbye world");
    assert_eq!(result.new_end.line, 0);
    assert_eq!(result.new_end.col, 7);
}

#[test]
fn test_buffer_multiline_insert() {
    let mut buffer = Buffer::new("test.txt".to_string(), "line 1\nline 3", None);

    let edit = EditOperation {
        range: TextRange {
            start_line: 0,
            start_col: 6,
            end_line: 0,
            end_col: 6,
        },
        new_text: "\nline 2".to_string(),
    };

    let result = apply_edit(&mut buffer, edit);

    assert_eq!(buffer.rope.to_string(), "line 1\nline 2\nline 3");
    assert_eq!(buffer.rope.len_lines(), 3);
    assert_eq!(result.new_end.line, 1);
    assert_eq!(result.new_end.col, 6);
}

#[test]
fn test_buffer_multiline_delete() {
    let mut buffer = Buffer::new("test.txt".to_string(), "line 1\nline 2\nline 3", None);

    // Delete "line 2\n"
    let edit = EditOperation {
        range: TextRange {
            start_line: 1,
            start_col: 0,
            end_line: 2,
            end_col: 0,
        },
        new_text: String::new(),
    };

    let result = apply_edit(&mut buffer, edit);

    assert_eq!(buffer.rope.to_string(), "line 1\nline 3");
    assert_eq!(buffer.rope.len_lines(), 2);
    assert_eq!(result.new_end.line, 1);
    assert_eq!(result.new_end.col, 0);
}

#[test]
fn test_buffer_version_increments() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello", None);

    assert_eq!(buffer.version, 0);

    apply_edit(
        &mut buffer,
        EditOperation {
            range: TextRange {
                start_line: 0,
                start_col: 5,
                end_line: 0,
                end_col: 5,
            },
            new_text: " world".to_string(),
        },
    );
    assert_eq!(buffer.version, 1);

    apply_edit(
        &mut buffer,
        EditOperation {
            range: TextRange {
                start_line: 0,
                start_col: 11,
                end_line: 0,
                end_col: 11,
            },
            new_text: "!".to_string(),
        },
    );
    assert_eq!(buffer.version, 2);
}

#[test]
fn test_buffer_manager_open_close() {
    let mut manager = BufferManager::new();

    let id = manager
        .open("test1".to_string(), "content 1", None)
        .unwrap();
    assert_eq!(id, "test1");
    assert!(manager.get(&id).is_some());

    let id2 = manager
        .open("test2".to_string(), "content 2", None)
        .unwrap();
    assert_eq!(id2, "test2");
    assert!(manager.get(&id2).is_some());

    manager.close(&id);
    assert!(manager.get(&id).is_none());
    assert!(manager.get(&id2).is_some());
}

#[tokio::test]
async fn test_buffer_manager_multiple_buffers() {
    let mut manager = BufferManager::new();

    manager.open("buf1".to_string(), "content 1", None).unwrap();
    manager.open("buf2".to_string(), "content 2", None).unwrap();
    manager.open("buf3".to_string(), "content 3", None).unwrap();

    assert!(manager.get("buf1").is_some());
    assert!(manager.get("buf2").is_some());
    assert!(manager.get("buf3").is_some());

    // Lock each buffer to read content
    if let Some(buffer_arc) = manager.get("buf1") {
        let buffer = buffer_arc.read().await;
        assert_eq!(buffer.rope.to_string(), "content 1");
    }
    if let Some(buffer_arc) = manager.get("buf2") {
        let buffer = buffer_arc.read().await;
        assert_eq!(buffer.rope.to_string(), "content 2");
    }
    if let Some(buffer_arc) = manager.get("buf3") {
        let buffer = buffer_arc.read().await;
        assert_eq!(buffer.rope.to_string(), "content 3");
    }
}

#[test]
fn test_buffer_lazy_parsing() {
    let mut buffer = Buffer::new(
        "test.js".to_string(),
        "const x = 42;",
        Some(std::path::PathBuf::from("/tmp/test.js")),
    );

    // Tree should be None initially
    assert!(buffer.tree.is_none());

    // First parse
    buffer.parse_if_needed();
    assert!(buffer.tree.is_some());

    // Second call should not reparse
    buffer.parse_if_needed();
    assert!(buffer.tree.is_some());
}

#[test]
fn test_buffer_history_tracked() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello", None);

    // History should start empty (no undos)
    assert!(!buffer.history.can_undo());
    assert!(!buffer.history.can_redo());

    // Apply edit
    apply_edit(
        &mut buffer,
        EditOperation {
            range: TextRange {
                start_line: 0,
                start_col: 5,
                end_line: 0,
                end_col: 5,
            },
            new_text: " world".to_string(),
        },
    );

    // Finalize to move to undo stack
    buffer.history.finalize_pending();

    // Should be able to undo now
    assert!(buffer.history.can_undo());
    assert!(!buffer.history.can_redo());
}

#[test]
fn test_buffer_empty_content() {
    let buffer = Buffer::new("empty.txt".to_string(), "", None);

    assert_eq!(buffer.rope.to_string(), "");
    assert_eq!(buffer.rope.len_lines(), 1); // Ropey always has at least 1 line
    assert_eq!(buffer.rope.len_chars(), 0);
}

#[test]
fn test_buffer_unicode() {
    let content = "Hello 世界 🌍";
    let buffer = Buffer::new("unicode.txt".to_string(), content, None);

    assert_eq!(buffer.rope.to_string(), content);
    assert_eq!(buffer.rope.len_chars(), 10); // H e l l o SP 世 界 SP 🌍 = 10 chars
}

#[test]
fn test_buffer_large_content() {
    // Test with 10,000 lines
    let lines: Vec<String> = (0..10000).map(|i| format!("Line {}", i)).collect();
    let content = lines.join("\n");

    let buffer = Buffer::new("large.txt".to_string(), &content, None);

    assert_eq!(buffer.rope.len_lines(), 10000);
    assert!(buffer.rope.len_chars() > 60000); // At least "Line 0" * 10000 = 60k chars
}
