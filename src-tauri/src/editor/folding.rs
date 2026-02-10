use crate::editor::buffer::Buffer;
use serde::Serialize;

/// Kind of foldable region.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub enum FoldKind {
    Comment,
    Import,
    Region,
    Block,
}

/// Foldable range in a document.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FoldRange {
    pub start_line: u32,
    pub end_line: u32,
    pub kind: FoldKind,
}

/// Compute basic fold ranges from the syntax tree.
///
/// This implementation is intentionally generic:
/// - Any multi-line block-like node becomes a `Block` fold
/// - Multi-line comments become `Comment` folds
/// - Consecutive import statements become an `Import` fold
pub fn compute_fold_ranges(buffer: &Buffer) -> Vec<FoldRange> {
    let mut ranges = Vec::new();
    let tree = match &buffer.tree {
        Some(t) => t,
        None => return ranges,
    };

    let root = tree.root_node();
    let mut cursor = root.walk();

    fn add_range(ranges: &mut Vec<FoldRange>, start_row: u32, end_row: u32, kind: FoldKind) {
        if end_row > start_row {
            ranges.push(FoldRange {
                start_line: start_row,
                end_line: end_row,
                kind,
            });
        }
    }

    fn visit(
        cursor: &mut tree_sitter::TreeCursor,
        buffer: &Buffer,
        ranges: &mut Vec<FoldRange>,
    ) {
        let node = cursor.node();
        let kind = node.kind();
        let range = node.range();

        let start_row = range.start_point.row as u32;
        let end_row = range.end_point.row as u32;

        // Multi-line comments
        if matches!(kind, "comment" | "block_comment" | "doc_comment") && end_row > start_row {
            add_range(ranges, start_row, end_row, FoldKind::Comment);
        }

        // Block-like constructs
        if end_row > start_row {
            let is_block_like = matches!(
                kind,
                "function_declaration"
                    | "method_definition"
                    | "class_declaration"
                    | "function_item"
                    | "impl_item"
                    | "struct_item"
                    | "enum_item"
                    | "trait_item"
                    | "if_statement"
                    | "else_clause"
                    | "for_statement"
                    | "while_statement"
                    | "match_expression"
                    | "block"
                    | "switch_statement"
                    | "try_statement"
                    | "catch_clause"
            );

            if is_block_like {
                add_range(ranges, start_row, end_row, FoldKind::Block);
            }
        }

        // Recurse into children
        if cursor.goto_first_child() {
            loop {
                visit(cursor, buffer, ranges);
                if !cursor.goto_next_sibling() {
                    break;
                }
            }
            cursor.goto_parent();
        }
    }

    visit(&mut cursor, buffer, &mut ranges);

    // Simple import folding: group consecutive import-like lines at top of file
    add_import_folds(buffer, &mut ranges);

    ranges
}

fn add_import_folds(buffer: &Buffer, ranges: &mut Vec<FoldRange>) {
    let total_lines = buffer.rope.len_lines();
    if total_lines == 0 {
        return;
    }

    let mut start: Option<u32> = None;

    for line_idx in 0..total_lines {
        let line = buffer.rope.line(line_idx).to_string();
        let trimmed = line.trim_start();

        let is_import = trimmed.starts_with("import ")
            || trimmed.starts_with("use ")
            || trimmed.starts_with("#include ");

        if is_import {
            if start.is_none() {
                start = Some(line_idx as u32);
            }
        } else if start.is_some() {
            let s = start.take().unwrap();
            let e = line_idx as u32 - 1;
            if e > s {
                ranges.push(FoldRange {
                    start_line: s,
                    end_line: e,
                    kind: FoldKind::Import,
                });
            }
            // Stop scanning after first non-import block; imports are typically at top
            break;
        }
    }

    // Handle case where file ends with imports
    if let Some(s) = start {
        let e = total_lines.saturating_sub(1) as u32;
        if e > s {
            ranges.push(FoldRange {
                start_line: s,
                end_line: e,
                kind: FoldKind::Import,
            });
        }
    }
}
