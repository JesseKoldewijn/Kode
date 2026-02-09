use crate::editor::buffer::Buffer;
use crate::editor::languages::get_language;
use tree_sitter::{InputEdit, Parser};

pub fn update_tree(buffer: &mut Buffer, edit: Option<InputEdit>) {
    log::info!(
        "[update_tree] START: id={}, has_edit={}, tree_exists={}",
        buffer.id,
        edit.is_some(),
        buffer.tree.is_some()
    );

    let lang = match get_language(buffer.language) {
        Some(l) => l,
        None => {
            log::info!("[update_tree] No language support: id={}", buffer.id);
            return;
        }
    };

    let mut parser = Parser::new();
    if parser.set_language(&lang).is_err() {
        log::warn!("[update_tree] Failed to set language: id={}", buffer.id);
        return;
    }

    if let Some(edit) = edit {
        if let Some(tree) = &mut buffer.tree {
            tree.edit(&edit);
            log::info!(
                "[update_tree] Applied InputEdit to existing tree: id={}",
                buffer.id
            );
        }
    }

    let parse_start = std::time::Instant::now();
    buffer.tree = parser.parse_with(
        &mut |byte, _| -> &[u8] {
            if byte >= buffer.rope.len_bytes() {
                return &[];
            }
            let (chunk, chunk_byte, _, _) = buffer.rope.chunk_at_byte(byte);
            &chunk.as_bytes()[byte - chunk_byte..]
        },
        buffer.tree.as_ref(),
    );
    let parse_duration = parse_start.elapsed();
    log::info!(
        "[update_tree] COMPLETE: id={}, duration={:?}, incremental={}, success={}",
        buffer.id,
        parse_duration,
        edit.is_some(),
        buffer.tree.is_some()
    );
}
