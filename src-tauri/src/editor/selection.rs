use serde::{Deserialize, Serialize};

/// Represents a text selection with an anchor (start) and head (end) position.
/// The anchor is where the selection started, and the head is where it ends.
/// If anchor == head, this is a cursor position (zero-width selection).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Selection {
    /// Line number where the selection starts (0-indexed)
    pub anchor_line: u32,
    /// Column number where the selection starts (0-indexed)
    pub anchor_col: u32,
    /// Line number where the selection ends (0-indexed)
    pub head_line: u32,
    /// Column number where the selection ends (0-indexed)
    pub head_col: u32,
}

impl Selection {
    /// Creates a new selection from anchor to head
    pub fn new(anchor_line: u32, anchor_col: u32, head_line: u32, head_col: u32) -> Self {
        Selection {
            anchor_line,
            anchor_col,
            head_line,
            head_col,
        }
    }

    /// Creates a cursor (zero-width selection) at the given position
    pub fn cursor(line: u32, col: u32) -> Self {
        Selection {
            anchor_line: line,
            anchor_col: col,
            head_line: line,
            head_col: col,
        }
    }

    /// Returns true if this is a cursor (zero-width selection)
    pub fn is_cursor(&self) -> bool {
        self.anchor_line == self.head_line && self.anchor_col == self.head_col
    }

    /// Returns the start position (min of anchor and head)
    pub fn start(&self) -> (u32, u32) {
        if self.anchor_line < self.head_line
            || (self.anchor_line == self.head_line && self.anchor_col <= self.head_col)
        {
            (self.anchor_line, self.anchor_col)
        } else {
            (self.head_line, self.head_col)
        }
    }

    /// Returns the end position (max of anchor and head)
    pub fn end(&self) -> (u32, u32) {
        if self.anchor_line > self.head_line
            || (self.anchor_line == self.head_line && self.anchor_col >= self.head_col)
        {
            (self.anchor_line, self.anchor_col)
        } else {
            (self.head_line, self.head_col)
        }
    }

    /// Returns true if the selection is reversed (head is before anchor)
    pub fn is_reversed(&self) -> bool {
        self.head_line < self.anchor_line
            || (self.head_line == self.anchor_line && self.head_col < self.anchor_col)
    }

    /// Collapses the selection to the head position
    pub fn collapse_to_head(&mut self) {
        self.anchor_line = self.head_line;
        self.anchor_col = self.head_col;
    }

    /// Collapses the selection to the anchor position
    pub fn collapse_to_anchor(&mut self) {
        self.head_line = self.anchor_line;
        self.head_col = self.anchor_col;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionSet {
    pub buffer_id: String,
    pub selections: Vec<Selection>,
    /// The index of the primary selection (for multi-cursor support)
    pub primary_index: usize,
}

impl SelectionSet {
    pub fn new(buffer_id: String) -> Self {
        SelectionSet {
            buffer_id,
            selections: vec![Selection::cursor(0, 0)],
            primary_index: 0,
        }
    }

    pub fn with_selection(buffer_id: String, selection: Selection) -> Self {
        SelectionSet {
            buffer_id,
            selections: vec![selection],
            primary_index: 0,
        }
    }

    pub fn primary(&self) -> &Selection {
        &self.selections[self.primary_index]
    }

    pub fn primary_mut(&mut self) -> &mut Selection {
        &mut self.selections[self.primary_index]
    }

    /// Sets a single selection (replaces all existing selections)
    pub fn set_single(&mut self, selection: Selection) {
        self.selections = vec![selection];
        self.primary_index = 0;
    }

    /// Adds a new selection to the set
    pub fn add(&mut self, selection: Selection) {
        self.selections.push(selection);
    }

    /// Clears all selections and sets a single cursor at (0, 0)
    pub fn clear(&mut self) {
        self.selections = vec![Selection::cursor(0, 0)];
        self.primary_index = 0;
    }
}
