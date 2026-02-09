use kode_lib::editor::buffer::Buffer;
use kode_lib::editor::editing::{apply_edit, EditOperation, TextRange};
use kode_lib::editor::history::{History, HistoryEdit, UndoGroup};
use kode_lib::editor::selection::SelectionSet;
use std::thread;
use std::time::Duration;

#[test]
fn test_history_creation() {
    let history = History::new();

    assert!(!history.can_undo());
    assert!(!history.can_redo());
}

#[test]
fn test_history_single_edit() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    let edit = HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 5,
        },
        old_text: "hello".to_string(),
        new_text: "world".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    };

    history.add_edit(edit);
    history.finalize_pending();

    assert!(history.can_undo());
    assert!(!history.can_redo());
}

#[test]
fn test_history_undo_redo() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    let edit = HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "a".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    };

    history.add_edit(edit);
    history.finalize_pending();

    // Undo
    let group = history.undo();
    assert!(group.is_some());
    assert!(!history.can_undo());
    assert!(history.can_redo());

    // Redo
    let group = history.redo();
    assert!(group.is_some());
    assert!(history.can_undo());
    assert!(!history.can_redo());
}

#[test]
fn test_history_redo_cleared_on_new_edit() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    // Edit 1
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "a".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });
    history.finalize_pending();

    // Undo
    history.undo();
    assert!(history.can_redo());

    // Edit 2 - should clear redo stack
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "b".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    assert!(!history.can_redo());
}

#[test]
fn test_history_consecutive_inserts_grouped() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    // Type "hello" - each character should be grouped
    for (i, ch) in "hello".chars().enumerate() {
        history.add_edit(HistoryEdit {
            range: TextRange {
                start_line: 0,
                start_col: i as u32,
                end_line: 0,
                end_col: i as u32,
            },
            old_text: String::new(),
            new_text: ch.to_string(),
            old_selections: SelectionSet::new(buffer_id.clone()),
            new_selections: SelectionSet::new(buffer_id.clone()),
        });
    }

    history.finalize_pending();

    // Should have 1 undo group containing all 5 characters
    let group = history.undo();
    assert!(group.is_some());
    let group = group.unwrap();
    assert_eq!(group.edits.len(), 5);

    // No more undos
    assert!(!history.can_undo());
}

#[test]
fn test_history_timeout_creates_new_group() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    // Insert "a"
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "a".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    // Wait 350ms (exceeds 300ms timeout)
    thread::sleep(Duration::from_millis(350));

    // Insert "b" - should create new group
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 1,
            end_line: 0,
            end_col: 1,
        },
        old_text: String::new(),
        new_text: "b".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    history.finalize_pending();

    // First undo should undo "b" only
    let group1 = history.undo();
    assert!(group1.is_some());
    assert_eq!(group1.unwrap().edits.len(), 1);

    // Second undo should undo "a"
    let group2 = history.undo();
    assert!(group2.is_some());
    assert_eq!(group2.unwrap().edits.len(), 1);
}

#[test]
fn test_history_consecutive_deletes_grouped() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    // Simulate backspace 5 times at same position
    for _ in 0..5 {
        history.add_edit(HistoryEdit {
            range: TextRange {
                start_line: 0,
                start_col: 5,
                end_line: 0,
                end_col: 6,
            },
            old_text: "x".to_string(),
            new_text: String::new(),
            old_selections: SelectionSet::new(buffer_id.clone()),
            new_selections: SelectionSet::new(buffer_id.clone()),
        });
    }

    history.finalize_pending();

    // Should have 1 undo group
    let group = history.undo();
    assert!(group.is_some());
    assert_eq!(group.unwrap().edits.len(), 5);
}

#[test]
fn test_history_different_operations_not_grouped() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    // Insert "a"
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "a".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    // Delete "b" (different operation type)
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 1,
            end_line: 0,
            end_col: 2,
        },
        old_text: "b".to_string(),
        new_text: String::new(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    history.finalize_pending();

    // Should have 2 separate undo groups
    let group1 = history.undo();
    assert!(group1.is_some());
    assert_eq!(group1.unwrap().edits.len(), 1); // Delete

    let group2 = history.undo();
    assert!(group2.is_some());
    assert_eq!(group2.unwrap().edits.len(), 1); // Insert
}

#[test]
fn test_history_multichar_insert_not_grouped() {
    let mut history = History::new();
    let buffer_id = "test".to_string();

    // Insert multi-character string (like paste)
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "hello".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    // Insert another multi-char string
    history.add_edit(HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 5,
            end_line: 0,
            end_col: 5,
        },
        old_text: String::new(),
        new_text: " world".to_string(),
        old_selections: SelectionSet::new(buffer_id.clone()),
        new_selections: SelectionSet::new(buffer_id.clone()),
    });

    history.finalize_pending();

    // Multi-char inserts should NOT be grouped
    let group1 = history.undo();
    assert!(group1.is_some());
    assert_eq!(group1.unwrap().edits.len(), 1);

    let group2 = history.undo();
    assert!(group2.is_some());
    assert_eq!(group2.unwrap().edits.len(), 1);
}

#[test]
fn test_buffer_undo_restores_content() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello", None);

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

    assert_eq!(buffer.rope.to_string(), "hello world");

    // Undo
    if let Some(group) = buffer.history.undo() {
        for edit in group.edits.iter().rev() {
            let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize)
                + edit.range.start_col as usize;
            let end_byte = start_byte + edit.new_text.len();

            buffer.rope.remove(start_byte..end_byte);
            buffer.rope.insert(start_byte, &edit.old_text);
        }
    }

    assert_eq!(buffer.rope.to_string(), "hello");
}

#[test]
fn test_buffer_redo_restores_content() {
    let mut buffer = Buffer::new("test.txt".to_string(), "hello", None);

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

    // Undo
    if let Some(group) = buffer.history.undo() {
        for edit in group.edits.iter().rev() {
            let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize)
                + edit.range.start_col as usize;
            let end_byte = start_byte + edit.new_text.len();

            buffer.rope.remove(start_byte..end_byte);
            buffer.rope.insert(start_byte, &edit.old_text);
        }
    }

    assert_eq!(buffer.rope.to_string(), "hello");

    // Redo
    if let Some(group) = buffer.history.redo() {
        for edit in group.edits.iter() {
            let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize)
                + edit.range.start_col as usize;
            let end_byte = start_byte + edit.old_text.len();

            buffer.rope.remove(start_byte..end_byte);
            buffer.rope.insert(start_byte, &edit.new_text);
        }
    }

    assert_eq!(buffer.rope.to_string(), "hello world");
}

#[test]
fn test_history_multiple_undos() {
    let mut buffer = Buffer::new("test.txt".to_string(), "", None);

    // Edit 1: insert "a"
    apply_edit(
        &mut buffer,
        EditOperation {
            range: TextRange {
                start_line: 0,
                start_col: 0,
                end_line: 0,
                end_col: 0,
            },
            new_text: "a".to_string(),
        },
    );
    buffer.history.finalize_pending();

    // Edit 2: insert "b"
    apply_edit(
        &mut buffer,
        EditOperation {
            range: TextRange {
                start_line: 0,
                start_col: 1,
                end_line: 0,
                end_col: 1,
            },
            new_text: "b".to_string(),
        },
    );
    buffer.history.finalize_pending();

    // Edit 3: insert "c"
    apply_edit(
        &mut buffer,
        EditOperation {
            range: TextRange {
                start_line: 0,
                start_col: 2,
                end_line: 0,
                end_col: 2,
            },
            new_text: "c".to_string(),
        },
    );
    buffer.history.finalize_pending();

    assert_eq!(buffer.rope.to_string(), "abc");

    // Should be able to undo all 3
    assert!(buffer.history.can_undo());
    buffer.history.undo();
    assert!(buffer.history.can_undo());
    buffer.history.undo();
    assert!(buffer.history.can_undo());
    buffer.history.undo();
    assert!(!buffer.history.can_undo());
}

#[test]
fn test_undo_group_creation() {
    let mut group = UndoGroup::new();

    assert!(group.is_empty());

    let edit = HistoryEdit {
        range: TextRange {
            start_line: 0,
            start_col: 0,
            end_line: 0,
            end_col: 0,
        },
        old_text: String::new(),
        new_text: "a".to_string(),
        old_selections: SelectionSet::new("test".to_string()),
        new_selections: SelectionSet::new("test".to_string()),
    };

    group.add_edit(edit);

    assert!(!group.is_empty());
    assert_eq!(group.edits.len(), 1);
}
