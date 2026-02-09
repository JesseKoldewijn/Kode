use crate::editor::buffer::MANAGER;
use crate::editor::editing::{apply_edit, EditOperation, EditResult};
use crate::editor::error::Result;
use crate::editor::highlight::{get_viewport_highlights, ViewportHighlights};
use crate::editor::history::HistoryState;
use crate::editor::selection::{Selection, SelectionSet};
use serde::Serialize;
use std::path::PathBuf;

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
    log::info!("[edit_buffer] START: buffer_id={}, range=({},{})-({},{})", 
        buffer_id, edit.range.start_line, edit.range.start_col, edit.range.end_line, edit.range.end_col);
    
    // Get buffer Arc from map
    log::info!("[edit_buffer] Requesting map READ lock: buffer_id={}", buffer_id);
    let buffer_arc = {
        let map = MANAGER.read().await;
        log::info!("[edit_buffer] Map READ lock ACQUIRED: buffer_id={}", buffer_id);
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    }; // Map lock released
    log::info!("[edit_buffer] Map READ lock RELEASED: buffer_id={}", buffer_id);
    
    // Acquire per-buffer write lock
    log::info!("[edit_buffer] Requesting per-buffer WRITE lock: buffer_id={}", buffer_id);
    let result = {
        let mut buffer = buffer_arc.write().await;
        log::info!("[edit_buffer] Per-buffer WRITE lock ACQUIRED: buffer_id={}", buffer_id);
        
        let edit_start = std::time::Instant::now();
        let result = apply_edit(&mut buffer, edit);
        let edit_duration = edit_start.elapsed();
        log::info!("[edit_buffer] apply_edit COMPLETE: buffer_id={}, duration={:?}, new_version={}", 
            buffer_id, edit_duration, result.version);
        result
    }; // Write lock dropped here
    
    // Drop Arc
    drop(buffer_arc);
    
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
    log::info!("[open_buffer] START: path={}", path);
    
    // Use async file I/O to avoid blocking the runtime
    log::info!("[open_buffer] Requesting async file read: {}", path);
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| crate::editor::EditorError::Io(e.to_string()))?;
    log::info!("[open_buffer] File read complete: {} bytes, path={}", content.len(), path);
    
    // Acquire map write lock briefly to insert new buffer
    log::info!("[open_buffer] Requesting WRITE lock on map: path={}", path);
    let buffer_arc = {
        let mut map = MANAGER.write().await;
        log::info!("[open_buffer] Map WRITE lock ACQUIRED: path={}", path);
        map.open(path.clone(), &content, Some(PathBuf::from(&path)))?;
        let arc = map.get(&path).unwrap();
        log::info!("[open_buffer] Buffer created, releasing map WRITE lock: id={}", path);
        arc
    }; // Map write lock dropped here
    log::info!("[open_buffer] Map WRITE lock RELEASED: id={}", path);
    
    // Acquire per-buffer read lock to get info
    log::info!("[open_buffer] Requesting per-buffer READ lock: id={}", path);
    let result = {
        let buffer = buffer_arc.read().await;
        log::info!("[open_buffer] Per-buffer READ lock ACQUIRED: id={}", path);
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
    Ok(())
}

#[tauri::command]
pub async fn get_highlights(buffer_id: String, start_line: u32, end_line: u32) -> Result<ViewportHighlights> {
    log::info!("[get_highlights] START: buffer_id={}, lines={}-{}", buffer_id, start_line, end_line);
    
    // Get buffer Arc from map
    log::info!("[get_highlights] Requesting map READ lock (get buffer): buffer_id={}", buffer_id);
    let buffer_arc = {
        let map = MANAGER.read().await;
        log::info!("[get_highlights] Map READ lock ACQUIRED (get buffer): buffer_id={}", buffer_id);
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    }; // Map lock released
    log::info!("[get_highlights] Map READ lock RELEASED (get buffer): buffer_id={}", buffer_id);
    
    // Check if buffer exists and is parsed
    log::info!("[get_highlights] Requesting per-buffer READ lock (check parse state): buffer_id={}", buffer_id);
    let is_parsed = {
        let buffer = buffer_arc.read().await;
        log::info!("[get_highlights] Per-buffer READ lock ACQUIRED (check): buffer_id={}", buffer_id);
        let parsed = buffer.tree.is_some();
        log::info!("[get_highlights] Parse state check: buffer_id={}, is_parsed={}", buffer_id, parsed);
        parsed
    };
    log::info!("[get_highlights] Per-buffer READ lock RELEASED (check): buffer_id={}", buffer_id);
    
    // If not parsed, trigger parsing in background and return empty highlights
    if !is_parsed {
        log::info!("[get_highlights] Buffer not parsed, spawning background parse task: buffer_id={}", buffer_id);
        let buffer_id_clone = buffer_id.clone();
        let arc_clone = buffer_arc.clone();
        tokio::spawn(async move {
            log::info!("[parse_task] START: buffer_id={}", buffer_id_clone);
            log::info!("[parse_task] Requesting per-buffer WRITE lock: buffer_id={}", buffer_id_clone);
            let parse_start = std::time::Instant::now();
            let mut buffer = arc_clone.write().await;
            let lock_duration = parse_start.elapsed();
            log::info!("[parse_task] Per-buffer WRITE lock ACQUIRED after {:?}: buffer_id={}", lock_duration, buffer_id_clone);
            
            log::info!("[parse_task] Calling parse_if_needed: buffer_id={}, language={:?}", buffer_id_clone, buffer.language);
            let parse_start_inner = std::time::Instant::now();
            buffer.parse_if_needed();
            let parse_duration = parse_start_inner.elapsed();
            log::info!("[parse_task] parse_if_needed COMPLETE: buffer_id={}, duration={:?}, tree_exists={}", 
                buffer_id_clone, parse_duration, buffer.tree.is_some());
            log::info!("[parse_task] Per-buffer WRITE lock will be RELEASED: buffer_id={}", buffer_id_clone);
        });
        
        // Return empty highlights immediately (frontend will retry after debounce)
        log::info!("[get_highlights] Returning empty highlights (parse pending): buffer_id={}", buffer_id);
        return Ok(ViewportHighlights {
            buffer_id: buffer_id.clone(),
            version: 0,
            lines: vec![],
            total_lines: 0,
        });
    }
    
    // Get highlights with per-buffer read lock (tree exists, so this is fast)
    log::info!("[get_highlights] Requesting per-buffer READ lock (render highlights): buffer_id={}", buffer_id);
    let result = {
        let buffer = buffer_arc.read().await;
        log::info!("[get_highlights] Per-buffer READ lock ACQUIRED (render): buffer_id={}", buffer_id);
        
        let highlight_start = std::time::Instant::now();
        let highlights = get_viewport_highlights(&buffer, start_line, end_line);
        let highlight_duration = highlight_start.elapsed();
        log::info!("[get_highlights] Highlighting COMPLETE: buffer_id={}, duration={:?}, line_count={}", 
            buffer_id, highlight_duration, highlights.lines.len());
        highlights
    }; // Per-buffer READ lock dropped here
    log::info!("[get_highlights] Per-buffer READ lock RELEASED: buffer_id={}", buffer_id);
    
    // Explicitly drop the Arc to ensure no references remain
    drop(buffer_arc);
    log::info!("[get_highlights] Arc dropped: buffer_id={}", buffer_id);
    
    Ok(result)
}

#[tauri::command]
pub async fn set_selections(buffer_id: String, selections: Vec<Selection>) -> Result<SelectionSet> {
    log::info!("[set_selections] START: buffer_id={}, selection_count={}", buffer_id, selections.len());
    
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
    log::info!("[undo_buffer] START: buffer_id={}", buffer_id);
    
    // Get buffer Arc from map
    log::info!("[undo_buffer] Requesting map READ lock: buffer_id={}", buffer_id);
    let buffer_arc = {
        let map = MANAGER.read().await;
        log::info!("[undo_buffer] Map READ lock ACQUIRED: buffer_id={}", buffer_id);
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    log::info!("[undo_buffer] Map READ lock RELEASED: buffer_id={}", buffer_id);
    
    // Acquire per-buffer write lock
    log::info!("[undo_buffer] Requesting per-buffer WRITE lock: buffer_id={}", buffer_id);
    let result = {
        let mut buffer = buffer_arc.write().await;
        log::info!("[undo_buffer] Per-buffer WRITE lock ACQUIRED: buffer_id={}", buffer_id);
        
        if let Some(group) = buffer.history.undo() {
            // Apply edits in reverse order (undo)
            for edit in group.edits.iter().rev() {
                // Replace new_text with old_text
                let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize) + edit.range.start_col as usize;
                let end_byte = start_byte + edit.new_text.len();
                
                buffer.rope.remove(start_byte..end_byte);
                buffer.rope.insert(start_byte, &edit.old_text);
                
                buffer.version += 1;
                buffer.is_dirty = true;
            }
            
            // Restore old selections from first edit
            if let Some(first_edit) = group.edits.first() {
                buffer.selections = first_edit.old_selections.clone();
            }
            
            // Invalidate parse tree (will be lazily re-parsed on next highlight request)
            buffer.tree = None;
            
            log::info!("[undo_buffer] COMPLETE (success): buffer_id={}, new_version={}", buffer_id, buffer.version);
            UndoRedoResult {
                success: true,
                version: buffer.version,
                content: buffer.rope.to_string(),
                selections: buffer.selections.clone(),
            }
        } else {
            log::info!("[undo_buffer] COMPLETE (no history): buffer_id={}", buffer_id);
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
    log::info!("[redo_buffer] START: buffer_id={}", buffer_id);
    
    // Get buffer Arc from map
    log::info!("[redo_buffer] Requesting map READ lock: buffer_id={}", buffer_id);
    let buffer_arc = {
        let map = MANAGER.read().await;
        log::info!("[redo_buffer] Map READ lock ACQUIRED: buffer_id={}", buffer_id);
        map.get(&buffer_id)
            .ok_or_else(|| crate::editor::EditorError::BufferNotFound(buffer_id.clone()))?
    };
    log::info!("[redo_buffer] Map READ lock RELEASED: buffer_id={}", buffer_id);
    
    // Acquire per-buffer write lock
    log::info!("[redo_buffer] Requesting per-buffer WRITE lock: buffer_id={}", buffer_id);
    let result = {
        let mut buffer = buffer_arc.write().await;
        log::info!("[redo_buffer] Per-buffer WRITE lock ACQUIRED: buffer_id={}", buffer_id);
        
        if let Some(group) = buffer.history.redo() {
            // Apply edits in forward order (redo)
            for edit in group.edits.iter() {
                // Replace old_text with new_text
                let start_byte = buffer.rope.line_to_byte(edit.range.start_line as usize) + edit.range.start_col as usize;
                let end_byte = start_byte + edit.old_text.len();
                
                buffer.rope.remove(start_byte..end_byte);
                buffer.rope.insert(start_byte, &edit.new_text);
                
                buffer.version += 1;
                buffer.is_dirty = true;
            }
            
            // Restore new selections from last edit
            if let Some(last_edit) = group.edits.last() {
                buffer.selections = last_edit.new_selections.clone();
            }
            
            // Invalidate parse tree (will be lazily re-parsed on next highlight request)
            buffer.tree = None;
            
            log::info!("[redo_buffer] COMPLETE (success): buffer_id={}, new_version={}", buffer_id, buffer.version);
            UndoRedoResult {
                success: true,
                version: buffer.version,
                content: buffer.rope.to_string(),
                selections: buffer.selections.clone(),
            }
        } else {
            log::info!("[redo_buffer] COMPLETE (no redo stack): buffer_id={}", buffer_id);
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
