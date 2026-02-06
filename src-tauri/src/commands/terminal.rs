use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread;
use portable_pty::{CommandBuilder, PtySize, native_pty_system};
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

// Global terminal sessions storage - use tokio::sync::Mutex for async-safe access
lazy_static::lazy_static! {
    static ref TERMINALS: Mutex<HashMap<String, TerminalSession>> = Mutex::new(HashMap::new());
}

struct TerminalSession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    // reader is moved to a thread, so we just track if it's alive
    _reader_handle: thread::JoinHandle<()>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalOutput {
    pub id: String,
    pub data: String,
}

/// Spawn a new terminal session
#[tauri::command]
pub async fn spawn_terminal(
    app: AppHandle,
    id: String,
    shell: Option<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to create PTY: {}", e))?;
    
    // Determine shell to use
    let shell_cmd = shell.unwrap_or_else(|| {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    });
    
    let mut cmd = CommandBuilder::new(&shell_cmd);
    
    // Set working directory
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }
    
    // Set environment
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    
    // Spawn the shell
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;
    
    let master = pair.master;
    let writer = master.take_writer().map_err(|e| format!("Failed to get writer: {}", e))?;
    let mut reader = master.try_clone_reader().map_err(|e| format!("Failed to get reader: {}", e))?;
    
    // Spawn reader thread
    let terminal_id = id.clone();
    let app_clone = app.clone();
    let reader_handle = thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit("terminal-output", TerminalOutput {
                        id: terminal_id.clone(),
                        data,
                    });
                }
                Err(_) => break,
            }
        }
    });
    
    // Store the session (including master for resize support)
    let mut terminals = TERMINALS.lock().await;
    terminals.insert(id, TerminalSession {
        writer,
        master,
        _reader_handle: reader_handle,
    });
    
    Ok(())
}

/// Write data to terminal
#[tauri::command]
pub async fn write_terminal(id: String, data: String) -> Result<(), String> {
    let mut terminals = TERMINALS.lock().await;
    
    let session = terminals.get_mut(&id).ok_or("Terminal not found")?;
    
    session.writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Failed to write: {}", e))?;
    
    session.writer
        .flush()
        .map_err(|e| format!("Failed to flush: {}", e))?;
    
    Ok(())
}

/// Resize terminal
#[tauri::command]
pub async fn resize_terminal(id: String, rows: u16, cols: u16) -> Result<(), String> {
    let terminals = TERMINALS.lock().await;
    
    let session = terminals.get(&id).ok_or("Terminal not found")?;
    
    session.master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize terminal: {}", e))?;
    
    log::info!("Resized terminal {}: {}x{}", id, cols, rows);
    Ok(())
}

/// Close terminal session
#[tauri::command]
pub async fn close_terminal(id: String) -> Result<(), String> {
    let mut terminals = TERMINALS.lock().await;
    terminals.remove(&id);
    Ok(())
}
