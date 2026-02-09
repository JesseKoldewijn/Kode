use crate::editor::buffer::Buffer;
use crate::editor::history::HistoryEdit;
use crate::editor::parsing::update_tree;
use serde::{Deserialize, Serialize};
use tree_sitter::{InputEdit, Point};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EditOperation {
    pub range: TextRange,
    pub new_text: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TextRange {
    pub start_line: u32,
    pub start_col: u32,
    pub end_line: u32,
    pub end_col: u32,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub line: u32,
    pub col: u32,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EditResult {
    pub version: u64,
    pub applied_range: TextRange,
    pub new_end: Position,
}

pub fn apply_edit(buffer: &mut Buffer, edit: EditOperation) -> EditResult {
    let start_byte =
        buffer.rope.line_to_byte(edit.range.start_line as usize) + edit.range.start_col as usize;
    let end_byte =
        buffer.rope.line_to_byte(edit.range.end_line as usize) + edit.range.end_col as usize;

    // Store old text for undo
    let old_text = buffer.rope.slice(start_byte..end_byte).to_string();

    // Store old selections
    let old_selections = buffer.selections.clone();

    // Perform the edit in ropey
    buffer.rope.remove(start_byte..end_byte);
    buffer.rope.insert(start_byte, &edit.new_text);

    buffer.version += 1;
    buffer.is_dirty = true;

    // Compute InputEdit for tree-sitter
    let new_end_byte = start_byte + edit.new_text.len();
    let new_end_line = buffer.rope.byte_to_line(new_end_byte) as u32;
    let new_end_col = (new_end_byte - buffer.rope.line_to_byte(new_end_line as usize)) as u32;

    let ts_edit = InputEdit {
        start_byte,
        old_end_byte: end_byte,
        new_end_byte,
        start_position: Point::new(
            edit.range.start_line as usize,
            edit.range.start_col as usize,
        ),
        old_end_position: Point::new(edit.range.end_line as usize, edit.range.end_col as usize),
        new_end_position: Point::new(new_end_line as usize, new_end_col as usize),
    };

    // Update tree-sitter tree
    update_tree(buffer, Some(ts_edit));

    // Store new selections (will be current after edit)
    let new_selections = buffer.selections.clone();

    // Add to history
    let history_edit = HistoryEdit {
        range: edit.range.clone(),
        old_text,
        new_text: edit.new_text,
        old_selections,
        new_selections,
    };
    buffer.history.add_edit(history_edit);

    EditResult {
        version: buffer.version,
        applied_range: edit.range,
        new_end: Position {
            line: new_end_line,
            col: new_end_col,
        },
    }
}
