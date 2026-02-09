use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::thread;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

// Global agent sessions storage - use tokio::sync::Mutex for async-safe access
lazy_static::lazy_static! {
    static ref AGENTS: Mutex<HashMap<String, AgentSession>> = Mutex::new(HashMap::new());
}

struct AgentSession {
    child: Child,
    stdin: Option<std::process::ChildStdin>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentOutput {
    pub id: String,
    pub stream: String, // "stdout" or "stderr"
    pub data: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentExit {
    pub id: String,
    pub code: Option<i32>,
}

/// Start an AI agent (e.g., OpenCode CLI)
#[tauri::command]
pub async fn start_agent(
    app: AppHandle,
    id: String,
    command: String,
    args: Vec<String>,
    cwd: Option<String>,
) -> Result<(), String> {
    // Clone values for the blocking closure
    let cmd_str = command.clone();
    let args_clone = args.clone();
    let cwd_clone = cwd.clone();

    // Spawn the process in a blocking task to avoid blocking the async runtime
    let spawn_result = tokio::task::spawn_blocking(move || {
        let mut cmd = Command::new(&cmd_str);
        cmd.args(&args_clone);

        // Set working directory
        if let Some(dir) = cwd_clone {
            cmd.current_dir(dir);
        }

        // Configure stdio
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        // Set environment for better output
        cmd.env("FORCE_COLOR", "1");
        cmd.env("TERM", "xterm-256color");

        cmd.spawn()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Failed to spawn agent: {}", e))?;

    let mut child = spawn_result;
    
    let stdin = child.stdin.take();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    
    // Spawn stdout reader thread
    if let Some(stdout) = stdout {
        let agent_id = id.clone();
        let app_clone = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let _ = app_clone.emit("agent-output", AgentOutput {
                    id: agent_id.clone(),
                    stream: "stdout".to_string(),
                    data: line,
                });
            }
        });
    }
    
    // Spawn stderr reader thread
    if let Some(stderr) = stderr {
        let agent_id = id.clone();
        let app_clone = app.clone();
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = app_clone.emit("agent-output", AgentOutput {
                    id: agent_id.clone(),
                    stream: "stderr".to_string(),
                    data: line,
                });
            }
        });
    }
    
    // Spawn exit watcher thread
    let agent_id = id.clone();
    let app_clone = app.clone();
    let child_id = child.id();
    thread::spawn(move || {
        // Wait for the child process to exit
        loop {
            thread::sleep(std::time::Duration::from_millis(100));
            
            // Check if process still exists using kill(pid, 0)
            #[cfg(unix)]
            {
                let status = unsafe { libc::kill(child_id as i32, 0) };
                if status != 0 {
                    let _ = app_clone.emit("agent-exit", AgentExit {
                        id: agent_id,
                        code: None,
                    });
                    break;
                }
            }
            
            #[cfg(windows)]
            {
                // Windows implementation would go here
                break;
            }
        }
    });
    
    // Store the session
    let mut agents = AGENTS.lock().await;
    agents.insert(id, AgentSession { child, stdin });
    
    Ok(())
}

/// Send input to an agent
#[tauri::command]
pub async fn send_to_agent(id: String, data: String) -> Result<(), String> {
    let mut agents = AGENTS.lock().await;
    
    let session = agents.get_mut(&id).ok_or("Agent not found")?;
    
    if let Some(ref mut stdin) = session.stdin {
        stdin.write_all(data.as_bytes()).map_err(|e| format!("Failed to write: {}", e))?;
        stdin.write_all(b"\n").map_err(|e| format!("Failed to write newline: {}", e))?;
        stdin.flush().map_err(|e| format!("Failed to flush: {}", e))?;
    } else {
        return Err("Agent stdin not available".to_string());
    }
    
    Ok(())
}

/// Stop an agent
#[tauri::command]
pub async fn stop_agent(id: String) -> Result<(), String> {
    let mut agents = AGENTS.lock().await;
    
    if let Some(mut session) = agents.remove(&id) {
        let _ = session.child.kill();
    }
    
    Ok(())
}
