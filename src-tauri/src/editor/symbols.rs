use crate::editor::buffer::Buffer;
use serde::Serialize;

/// Rough categorization of symbols for outline views.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub enum SymbolKind {
    Function,
    Class,
    Method,
    Variable,
    Constant,
    Interface,
    Module,
    Struct,
    Enum,
    Trait,
    Unknown,
}

/// Document symbol, following the structure from the migration plan.
#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSymbol {
    pub name: String,
    pub kind: SymbolKind,
    pub start_line: u32,
    pub end_line: u32,
    pub start_col: u32,
    pub end_col: u32,
    pub children: Vec<DocumentSymbol>,
}

/// Extract a flat list of symbols from the buffer's syntax tree.
///
/// This is intentionally conservative: it targets common node kinds for
/// JavaScript/TypeScript/Rust/Python and falls back to `Unknown` where needed.
pub fn extract_document_symbols(buffer: &Buffer) -> Vec<DocumentSymbol> {
    let mut out = Vec::new();
    let tree = match &buffer.tree {
        Some(t) => t,
        None => {
            // If we don't have a tree yet, return empty; caller can retry later.
            return out;
        }
    };

    let root = tree.root_node();
    let mut cursor = root.walk();

    fn visit(
        node_id: &mut tree_sitter::TreeCursor,
        buffer: &Buffer,
        out: &mut Vec<DocumentSymbol>,
    ) {
        let node = node_id.node();
        let kind = node.kind();

        // Skip very top-level container nodes
        let is_container = matches!(
            kind,
            "program"
                | "source_file"
                | "module"
                | "script"
                | "translation_unit"
        );

        if !is_container {
            if let Some(symbol) = symbol_from_node(&node, buffer) {
                out.push(symbol);
            }
        }

        if node_id.goto_first_child() {
            loop {
                visit(node_id, buffer, out);
                if !node_id.goto_next_sibling() {
                    break;
                }
            }
            node_id.goto_parent();
        }
    }

    visit(&mut cursor, buffer, &mut out);
    out
}

fn symbol_from_node(node: &tree_sitter::Node, buffer: &Buffer) -> Option<DocumentSymbol> {
    use SymbolKind::*;

    let kind_str = node.kind();
    let (symbol_kind, name_field) = match kind_str {
        // JavaScript / TypeScript
        "function_declaration" => (Function, "name"),
        "method_definition" => (Method, "name"),
        "class_declaration" => (Class, "name"),
        "lexical_declaration" | "variable_declaration" => (Variable, "name"),
        "enum_declaration" => (Enum, "name"),
        "interface_declaration" => (Interface, "name"),
        // Rust
        "function_item" => (Function, "name"),
        "struct_item" => (Struct, "name"),
        "enum_item" => (Enum, "name"),
        "trait_item" => (Trait, "name"),
        "impl_item" => (Class, "name"),
        // Python
        "function_definition" => (Function, "name"),
        "class_definition" => (Class, "name"),
        // Fallback: treat any node with a `name` field as a symbol
        _ => (Unknown, "name"),
    };

    let name_node = node.child_by_field_name(name_field)?;
    // Tree-sitter expects a stable byte slice; build a local String first.
    let rope_string = buffer.rope.to_string();
    let name = name_node.utf8_text(rope_string.as_bytes()).ok()?;

    let range = node.range();
    let start_line = range.start_point.row as u32;
    let end_line = range.end_point.row as u32;
    let start_col = range.start_point.column as u32;
    let end_col = range.end_point.column as u32;

    Some(DocumentSymbol {
        name: name.to_string(),
        kind: symbol_kind,
        start_line,
        end_line,
        start_col,
        end_col,
        children: Vec::new(),
    })
}
