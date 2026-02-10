use crate::editor::buffer::MANAGER;
use crate::editor::editing::{apply_edit, EditOperation, EditResult};
use crate::editor::error::Result;
use crate::editor::highlight::{get_viewport_highlights, ViewportHighlights};
use crate::editor::history::HistoryState;
use crate::editor::parsing::update_tree;
use crate::editor::search::{search_in_buffer, SearchMatch, SearchOptions};
use crate::editor::selection::{Selection, SelectionSet};
use crate::editor::symbols::DocumentSymbol;
use crate::editor::folding::{FoldRange, compute_fold_ranges};
use serde::Serialize;
use std::path::PathBuf;
use tree_sitter::{InputEdit, Point};

// Test command to verify Tauri IPC is working
#[tauri::command]
pub async fn test_simple_command(message: String) -> std::result::Result<String, String> {
    log::info!("[test_simple_command] Received: {}", message);
    let response = format!("Echo: {}", message);
    log::info!("[test_simple_command] Returning: {}", response);
    Ok(response)
}

// ... existing BufferInfo ...

#[tauri::command]
pub async fn edit_buffer(buffer_id: String, edit: EditOperation) -> Result<EditResult> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    }; // Map lock released

    // Acquire per-buffer write lock and apply edit; capture content/version for LSP
    let (result, lsp_content) = {
        let mut buffer = buffer_arc.write().await;
        let result = apply_edit(&mut buffer, edit);
        let content = buffer.rope.to_string();
        let version = buffer.version;
        (result, (buffer_id.clone(), version, content))
    }; // Write lock dropped here

    drop(buffer_arc);

    tokio::spawn(async move {
        let (id, version, content) = lsp_content;
        if let Err(e) = crate::lsp::notify_did_change(id, version, content).await {
            log::debug!("[edit_buffer] LSP didChange: {}", e);
        }
    });

    Ok(result)
}

// Combined edit+selection result to reduce IPC round-trips
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditWithSelectionsResult {
    pub version: u64,
    pub selections: SelectionSet,
}

// Combined command: edit buffer and set selections in one IPC call
#[tauri::command]
pub async fn edit_buffer_with_selections(
    buffer_id: String,
    edit: EditOperation,
    selections: Vec<Selection>,
) -> Result<EditWithSelectionsResult> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    
    // Acquire per-buffer write lock once for both operations
    let (result, lsp_content) = {
        let mut buffer = buffer_arc.write().await;

        // Apply edit
        apply_edit(&mut buffer, edit);

        // Set selections
        if selections.is_empty() {
            buffer.selections.clear();
        } else {
            buffer.selections.selections = selections;
            buffer.selections.primary_index = 0;
        }

        let content = buffer.rope.to_string();
        let version = buffer.version;
        let id = buffer_id.clone();
        let result = EditWithSelectionsResult {
            version: buffer.version,
            selections: buffer.selections.clone(),
        };
        (result, (id, version, content))
    };

    drop(buffer_arc);

    tokio::spawn(async move {
        let (id, version, content) = lsp_content;
        if let Err(e) = crate::lsp::notify_did_change(id, version, content).await {
            log::debug!("[edit_buffer_with_selections] LSP didChange: {}", e);
        }
    });

    Ok(result)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BufferInfo {
    pub id: String,
    pub language: String,
    pub line_count: u32,
    pub char_count: u64,
    pub version: u64,
    pub is_dirty: bool,
    pub line_ending: String,
}

#[tauri::command]
pub async fn open_buffer(path: String) -> Result<BufferInfo> {
    // Use async file I/O to avoid blocking the runtime
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| crate::editor::EditorError::Io(e.to_string()))?;
    
    // Acquire map write lock briefly to insert new buffer
    let buffer_arc = {
        let mut map = MANAGER.write().await;
        map.open(path.clone(), &content, Some(PathBuf::from(&path)))?;
        map.get(&path).unwrap()
    }; // Map write lock dropped here
    
    // Acquire per-buffer read lock to get info
    let result = {
        let buffer = buffer_arc.read().await;
        BufferInfo {
            id: buffer.id.clone(),
            language: format!("{:?}", buffer.language),
            line_count: buffer.rope.len_lines() as u32,
            char_count: buffer.rope.len_chars() as u64,
            version: buffer.version,
            is_dirty: buffer.is_dirty,
            line_ending: format!("{:?}", buffer.line_ending),
        }
    }; // Per-buffer READ lock dropped here
    log::info!("[open_buffer] Per-buffer READ lock RELEASED: id={}", path);
    
    // Explicitly drop the Arc to ensure no references remain
    drop(buffer_arc);
    log::info!("[open_buffer] Arc dropped: id={}", path);
    
    log::info!("[open_buffer] COMPLETE: id={}, lines={}, chars={}", result.id, result.line_count, result.char_count);

    // Notify LSP in background (do not block response)
    let path_for_lsp = path.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::lsp::notify_did_open(path_for_lsp).await {
            log::debug!("[open_buffer] LSP didOpen: {}", e);
        }
    });

    Ok(result)
}

/// Get up-to-date buffer metadata for an already-open buffer.
#[tauri::command]
pub async fn get_buffer_info(buffer_id: String) -> Result<BufferInfo> {
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };

    let result = {
        let buffer = buffer_arc.read().await;
        BufferInfo {
            id: buffer.id.clone(),
            language: format!("{:?}", buffer.language),
            line_count: buffer.rope.len_lines() as u32,
            char_count: buffer.rope.len_chars() as u64,
            version: buffer.version,
            is_dirty: buffer.is_dirty,
            line_ending: format!("{:?}", buffer.line_ending),
        }
    };

    drop(buffer_arc);
    Ok(result)
}

#[tauri::command]
pub async fn close_buffer(buffer_id: String) -> Result<()> {
    log::info!("[close_buffer] START: buffer_id={}", buffer_id);
    log::info!("[close_buffer] Requesting map WRITE lock: buffer_id={}", buffer_id);
    let mut map = MANAGER.write().await;
    log::info!("[close_buffer] Map WRITE lock ACQUIRED: buffer_id={}", buffer_id);
    map.close(&buffer_id);
    log::info!("[close_buffer] COMPLETE: buffer_id={}", buffer_id);
    drop(map);

    let id_for_lsp = buffer_id.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::lsp::notify_did_close(id_for_lsp).await {
            log::debug!("[close_buffer] LSP didClose: {}", e);
        }
    });

    Ok(())
}

/// Search within a single buffer using the rope content.
#[tauri::command]
pub async fn search_buffer(
    buffer_id: String,
    query: String,
    is_regex: bool,
    case_sensitive: bool,
) -> Result<Vec<SearchMatch>> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };

    let result = {
        let buffer = buffer_arc.read().await;
        let options = SearchOptions {
            is_regex,
            case_sensitive,
        };
        search_in_buffer(&buffer, &query, options)
    };

    drop(buffer_arc);
    result
}

#[tauri::command]
pub async fn get_highlights(buffer_id: String, start_line: u32, end_line: u32) -> Result<ViewportHighlights> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    }; // Map lock released
    
    // Check if buffer exists and is parsed
    let is_parsed = {
        let buffer = buffer_arc.read().await;
        buffer.tree.is_some()
    };
    
    // If not parsed, trigger parsing in background and return empty highlights
    if !is_parsed {
        let arc_clone = buffer_arc.clone();
        tokio::spawn(async move {
            let mut buffer = arc_clone.write().await;
            buffer.parse_if_needed();
        });
        
        // Return empty highlights immediately (frontend will retry after debounce)
        return Ok(ViewportHighlights {
            buffer_id: buffer_id.clone(),
            version: 0,
            lines: vec![],
            total_lines: 0,
        });
    }
    
    // Get highlights with per-buffer read lock (tree exists, so this is fast)
    let result = {
        let buffer = buffer_arc.read().await;
        get_viewport_highlights(&buffer, start_line, end_line)
    }; // Per-buffer READ lock dropped here
    
    // Explicitly drop the Arc to ensure no references remain
    drop(buffer_arc);
    
    Ok(result)
}

/// Get a flat list of document symbols for an open buffer.
#[tauri::command]
pub async fn get_symbols(buffer_id: String) -> Result<Vec<DocumentSymbol>> {
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };

    let result = {
        let buffer = buffer_arc.read().await;
        Ok(crate::editor::symbols::extract_document_symbols(&buffer))
    };

    drop(buffer_arc);
    result
}

/// Get all foldable ranges for an open buffer.
#[tauri::command]
pub async fn get_fold_ranges(buffer_id: String) -> Result<Vec<FoldRange>> {
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };

    let result = {
        let buffer = buffer_arc.read().await;
        Ok(compute_fold_ranges(&buffer))
    };

    drop(buffer_arc);
    result
}

#[tauri::command]
pub async fn set_selections(buffer_id: String, selections: Vec<Selection>) -> Result<SelectionSet> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    
    // Acquire per-buffer write lock
    let result = {
        let mut buffer = buffer_arc.write().await;
        
        if selections.is_empty() {
            buffer.selections.clear();
        } else {
            buffer.selections.selections = selections;
            buffer.selections.primary_index = 0;
        }
        
        buffer.selections.clone()
    }; // Write lock dropped here
    
    // Drop Arc
    drop(buffer_arc);
    
    log::info!("[set_selections] COMPLETE: buffer_id={}", buffer_id);
    Ok(result)
}

#[tauri::command]
pub async fn get_selections(buffer_id: String) -> Result<SelectionSet> {
    log::info!("[get_selections] START: buffer_id={}", buffer_id);
    
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    
    // Acquire per-buffer read lock
    let result = {
        let buffer = buffer_arc.read().await;
        buffer.selections.clone()
    }; // Read lock dropped here
    
    // Drop Arc
    drop(buffer_arc);
    
    log::info!("[get_selections] COMPLETE: buffer_id={}", buffer_id);
    Ok(result)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UndoRedoResult {
    pub success: bool,
    pub version: u64,
    pub content: String,
    pub selections: SelectionSet,
}

#[tauri::command]
pub async fn undo_buffer(buffer_id: String) -> Result<UndoRedoResult> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    
    // Acquire per-buffer write lock
    let result = {
        let mut buffer = buffer_arc.write().await;
        
        if let Some(group) = buffer.history.undo() {
            // Apply edits in reverse order (undo)
            for edit in group.edits.iter().rev() {
                // Replace new_text with old_text
                let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize) + edit.range.start_col as usize;
                let end_byte = start_byte + edit.new_text.len();
                
                buffer.rope.remove(start_byte..end_byte);
                buffer.rope.insert(start_byte, &edit.old_text);
                
                // Compute InputEdit for incremental re-parse
                let new_end_byte = start_byte + edit.old_text.len();
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
                    old_end_position: Point::new(
                        edit.range.end_line as usize,
                        edit.range.end_col as usize,
                    ),
                    new_end_position: Point::new(new_end_line as usize, new_end_col as usize),
                };
                
                // Update tree-sitter tree incrementally
                update_tree(&mut buffer, Some(ts_edit));
                
                buffer.version += 1;
                buffer.is_dirty = true;
            }
            
            // Restore old selections from first edit
            if let Some(first_edit) = group.edits.first() {
                buffer.selections = first_edit.old_selections.clone();
            }
            
            UndoRedoResult {
                success: true,
                version: buffer.version,
                content: buffer.rope.to_string(),
                selections: buffer.selections.clone(),
            }
        } else {
            UndoRedoResult {
                success: false,
                version: buffer.version,
                content: buffer.rope.to_string(),
                selections: buffer.selections.clone(),
            }
        }
    }; // Write lock dropped here
    
    // Drop Arc
    drop(buffer_arc);
    
    Ok(result)
}

#[tauri::command]
pub async fn redo_buffer(buffer_id: String) -> Result<UndoRedoResult> {
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    
    // Acquire per-buffer write lock
    let result = {
        let mut buffer = buffer_arc.write().await;
        
        if let Some(group) = buffer.history.redo() {
            // Apply edits in forward order (redo)
            for edit in group.edits.iter() {
                // Replace old_text with new_text
                let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize) + edit.range.start_col as usize;
                let end_byte = start_byte + edit.old_text.len();
                
                buffer.rope.remove(start_byte..end_byte);
                buffer.rope.insert(start_byte, &edit.new_text);
                
                // Compute InputEdit for incremental re-parse
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
                    old_end_position: Point::new(
                        edit.range.end_line as usize,
                        edit.range.end_col as usize,
                    ),
                    new_end_position: Point::new(new_end_line as usize, new_end_col as usize),
                };
                
                // Update tree-sitter tree incrementally
                update_tree(&mut buffer, Some(ts_edit));
                
                buffer.version += 1;
                buffer.is_dirty = true;
            }
            
            // Restore new selections from last edit
            if let Some(last_edit) = group.edits.last() {
                buffer.selections = last_edit.new_selections.clone();
            }
            
            UndoRedoResult {
                success: true,
                version: buffer.version,
                content: buffer.rope.to_string(),
                selections: buffer.selections.clone(),
            }
        } else {
            UndoRedoResult {
                success: false,
                version: buffer.version,
                content: buffer.rope.to_string(),
                selections: buffer.selections.clone(),
            }
        }
    }; // Write lock dropped here
    
    // Drop Arc
    drop(buffer_arc);
    
    Ok(result)
}

#[tauri::command]
pub async fn get_history_state(buffer_id: String) -> Result<HistoryState> {
    log::info!("[get_history_state] START: buffer_id={}", buffer_id);
    
    // Get buffer Arc from map
    let buffer_arc = {
        let map = MANAGER.read().await;
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    
    // Acquire per-buffer read lock
    let result = {
        let buffer = buffer_arc.read().await;
        HistoryState {
            can_undo: buffer.history.can_undo(),
            can_redo: buffer.history.can_redo(),
        }
    }; // Read lock dropped here
    
    // Drop Arc
    drop(buffer_arc);
    
    log::info!("[get_history_state] COMPLETE: buffer_id={}, can_undo={}, can_redo={}", 
        buffer_id, result.can_undo, result.can_redo);
    Ok(result)
}
