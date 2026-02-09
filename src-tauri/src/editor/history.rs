use crate::editor::editing::TextRange;
use crate::editor::selection::SelectionSet;
use serde::Serialize;
use std::time::{Duration, Instant};

/// A single edit operation that can be undone/redone
#[derive(Clone, Debug)]
pub struct HistoryEdit {
    /// The range that was replaced
    pub range: TextRange,
    /// The text that was deleted (for undo)
    pub old_text: String,
    /// The text that was inserted (for redo)
    pub new_text: String,
    /// Selection state before the edit
    pub old_selections: SelectionSet,
    /// Selection state after the edit
    pub new_selections: SelectionSet,
}

/// A group of edits that should be undone/redone together
#[derive(Clone, Debug)]
pub struct UndoGroup {
    pub edits: Vec<HistoryEdit>,
    pub timestamp: Instant,
}

impl UndoGroup {
    pub fn new() -> Self {
        UndoGroup {
            edits: Vec::new(),
            timestamp: Instant::now(),
        }
    }

    pub fn add_edit(&mut self, edit: HistoryEdit) {
        self.edits.push(edit);
        self.timestamp = Instant::now();
    }

    pub fn is_empty(&self) -> bool {
        self.edits.is_empty()
    }
}

/// History manager for undo/redo operations
pub struct History {
    /// Stack of undo groups (most recent last)
    undo_stack: Vec<UndoGroup>,
    /// Stack of redo groups (most recent last)
    redo_stack: Vec<UndoGroup>,
    /// Current pending group (for grouping consecutive edits)
    pending_group: Option<UndoGroup>,
    /// Maximum time between edits to group them together (300ms)
    group_timeout: Duration,
    /// Maximum number of undo groups to keep
    max_undo_groups: usize,
}

impl History {
    pub fn new() -> Self {
        History {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            pending_group: None,
            group_timeout: Duration::from_millis(300),
            max_undo_groups: 1000,
        }
    }

    /// Add an edit to the history
    pub fn add_edit(&mut self, edit: HistoryEdit) {
        // Clear redo stack when new edit is made
        self.redo_stack.clear();

        // Check if we should start a new group
        let should_start_new_group = if let Some(ref pending) = self.pending_group {
            // Start new group if timeout exceeded or if this is a different operation type
            pending.timestamp.elapsed() > self.group_timeout
                || !self.should_group_with_pending(&edit)
        } else {
            false
        };

        if should_start_new_group {
            // Finalize pending group
            if let Some(group) = self.pending_group.take() {
                if !group.is_empty() {
                    self.undo_stack.push(group);
                }
            }
        }

        // Add to pending group or create new one
        if let Some(ref mut group) = self.pending_group {
            group.add_edit(edit);
        } else {
            let mut group = UndoGroup::new();
            group.add_edit(edit);
            self.pending_group = Some(group);
        }

        // Limit stack size
        if self.undo_stack.len() > self.max_undo_groups {
            self.undo_stack.remove(0);
        }
    }

    /// Finalize any pending group (should be called when user stops editing)
    pub fn finalize_pending(&mut self) {
        if let Some(group) = self.pending_group.take() {
            if !group.is_empty() {
                self.undo_stack.push(group);
            }
        }
    }

    /// Check if an edit should be grouped with the current pending group
    fn should_group_with_pending(&self, edit: &HistoryEdit) -> bool {
        if let Some(ref group) = self.pending_group {
            if group.edits.is_empty() {
                return true;
            }

            let last_edit = &group.edits[group.edits.len() - 1];

            // Group consecutive single-character inserts
            if edit.old_text.is_empty()
                && edit.new_text.len() == 1
                && last_edit.old_text.is_empty()
                && last_edit.new_text.len() == 1
            {
                // Check if insert is at the end of previous insert
                return edit.range.start_line == last_edit.range.start_line
                    && edit.range.start_col
                        == last_edit.range.start_col + last_edit.new_text.len() as u32;
            }

            // Group consecutive single-character deletes
            if edit.new_text.is_empty()
                && edit.old_text.len() == 1
                && last_edit.new_text.is_empty()
                && last_edit.old_text.len() == 1
            {
                // Check if delete is adjacent to previous delete
                return (edit.range.start_line == last_edit.range.start_line
                    && edit.range.start_col == last_edit.range.start_col)
                    || (edit.range.start_line == last_edit.range.start_line
                        && edit.range.start_col + 1 == last_edit.range.start_col);
            }

            false
        } else {
            true
        }
    }

    /// Get the next undo group (returns None if nothing to undo)
    pub fn undo(&mut self) -> Option<UndoGroup> {
        // Finalize pending group first
        self.finalize_pending();

        if let Some(group) = self.undo_stack.pop() {
            self.redo_stack.push(group.clone());
            Some(group)
        } else {
            None
        }
    }

    /// Get the next redo group (returns None if nothing to redo)
    pub fn redo(&mut self) -> Option<UndoGroup> {
        // Finalize pending group first
        self.finalize_pending();

        if let Some(group) = self.redo_stack.pop() {
            self.undo_stack.push(group.clone());
            Some(group)
        } else {
            None
        }
    }

    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty() || self.pending_group.is_some()
    }

    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Clear all history
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
        self.pending_group = None;
    }
}

/// History state for serialization (sent to frontend)
#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HistoryState {
    pub can_undo: bool,
    pub can_redo: bool,
}
