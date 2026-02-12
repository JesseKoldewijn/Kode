//! Minimal LSP client: spawn server over stdio, JSON-RPC request/response,
//! store publishDiagnostics, expose diagnostics and goto definition.

use crate::editor::buffer::MANAGER;
use crate::editor::error::{EditorError, Result};
use lsp_types::{
    CompletionParams, DidChangeTextDocumentParams, DidOpenTextDocumentParams,
    GotoDefinitionParams, HoverParams, InitializeParams, Position,
    SignatureHelpParams, TextDocumentContentChangeEvent, TextDocumentItem,
    TextDocumentPositionParams, Url, VersionedTextDocumentIdentifier,
};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, Mutex, RwLock};
use tokio::time::{timeout, Duration};

/// LSP diagnostic for a single buffer (serializable for IPC).
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspDiagnostic {
    pub range: LspRange,
    pub message: String,
    pub severity: Option<u32>,
    pub source: Option<String>,
}

#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspRange {
    pub start_line: u32,
    pub start_character: u32,
    pub end_line: u32,
    pub end_character: u32,
}

/// Location for goto definition (file path + range).
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspLocation {
    pub path: String,
    pub start_line: u32,
    pub start_character: u32,
    pub end_line: u32,
    pub end_character: u32,
}

/// Hover result (plain text or markdown).
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspHoverResult {
    pub contents: String,
}

/// Completion item for UI.
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspCompletionItem {
    pub label: String,
    pub kind: Option<u32>,
    pub detail: Option<String>,
    pub insert_text: Option<String>,
}

/// Parameter information for signature help.
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspParameterInformation {
    pub label: String,
    pub documentation: Option<String>,
}

/// Signature information for signature help.
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspSignatureInformation {
    pub label: String,
    pub documentation: Option<String>,
    pub parameters: Option<Vec<LspParameterInformation>>,
}

/// Signature help result.
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LspSignatureHelp {
    pub signatures: Vec<LspSignatureInformation>,
    pub active_signature: Option<u32>,
    pub active_parameter: Option<u32>,
}

static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

fn next_request_id() -> u64 {
    REQUEST_ID.fetch_add(1, Ordering::SeqCst)
}

fn path_to_uri(path: &str) -> String {
    let path = path.replace('\\', "/");
    if path.starts_with('/') {
        format!("file://{}", path)
    } else {
        format!("file:///{}", path)
    }
}

fn uri_to_path(uri: &str) -> String {
    uri.strip_prefix("file://")
        .or_else(|| uri.strip_prefix("file:///"))
        .unwrap_or(uri)
        .replace('/', std::path::MAIN_SEPARATOR_STR)
}

/// Derive workspace root from a file path (parent directory).
fn workspace_root_from_path(path: &str) -> String {
    Path::new(path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Language key for session map (one server per workspace per language).
fn language_key_for_path(path: &str) -> Option<&'static str> {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "ts" | "tsx" | "mts" | "cts" | "js" | "jsx" | "mjs" | "cjs" => Some("ts"),
        "rs" => Some("rust"),
        "py" => Some("py"),
        _ => None,
    }
}

/// Session key: workspace_root + language so we can run TS and Rust in the same workspace.
fn session_key(workspace_root: &str, path: &str) -> Option<String> {
    let lang = language_key_for_path(path)?;
    Some(format!("{}|{}", workspace_root, lang))
}

/// Which language server to run for a given path/language.
fn server_command_for_path(path: &str) -> Option<(&'static str, Vec<&'static str>)> {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "ts" | "tsx" | "mts" | "cts" | "js" | "jsx" | "mjs" | "cjs" => {
            Some(("npx", vec!["typescript-language-server", "--stdio"]))
        }
        "rs" => Some(("rust-analyzer", vec![])),
        "py" => Some(("pyright-langserver", vec!["--stdio"])),
        _ => None,
    }
}

struct LspSession {
    _child: Child,
    stdin: Arc<Mutex<Option<tokio::process::ChildStdin>>>,
    pending: Arc<std::sync::Mutex<HashMap<u64, oneshot::Sender<Value>>>>,
    diagnostics: Arc<RwLock<HashMap<String, Vec<LspDiagnostic>>>>,
    _reader_handle: tokio::task::JoinHandle<()>,
}

// Wrap in Arc so we can release SESSIONS read lock before awaiting request.
type LspSessionRef = Arc<LspSession>;

impl LspSession {
    async fn send_request(&self, method: &str, params: Value) -> std::result::Result<Value, String> {
        let id = next_request_id();
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = self.pending.lock().map_err(|e| e.to_string())?;
            pending.insert(id, tx);
        }
        let message = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        });
        self.send_raw(&message).await?;
        let response = timeout(Duration::from_secs(10), rx)
            .await
            .map_err(|_| "LSP request timeout".to_string())?
            .map_err(|_| "LSP response channel closed".to_string())?;
        if let Some(err) = response.get("error") {
            let msg = err.get("message").and_then(Value::as_str).unwrap_or("Unknown error");
            return Err(msg.to_string());
        }
        response
            .get("result")
            .cloned()
            .ok_or_else(|| "No result in LSP response".to_string())
    }

    async fn send_raw(&self, message: &Value) -> std::result::Result<(), String> {
        let body = serde_json::to_string(message).map_err(|e| e.to_string())?;
        let msg = format!("Content-Length: {}\r\n\r\n{}", body.len(), body);
        let mut stdin = self.stdin.lock().await;
        if let Some(ref mut s) = *stdin {
            s.write_all(msg.as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            s.flush().await.map_err(|e| e.to_string())?;
        }
        Ok(())
    }

}

lazy_static::lazy_static! {
    static ref SESSIONS: Arc<RwLock<HashMap<String, LspSessionRef>>> = Arc::new(RwLock::new(HashMap::new()));
}

async fn read_loop(
    mut reader: BufReader<tokio::process::ChildStdout>,
    pending: Arc<std::sync::Mutex<HashMap<u64, oneshot::Sender<Value>>>>,
    diagnostics: Arc<RwLock<HashMap<String, Vec<LspDiagnostic>>>>,
) {
    let mut content_length = 0usize;
    let mut buffer = String::new();
    loop {
        buffer.clear();
        match reader.read_line(&mut buffer).await {
            Ok(0) => break,
            Err(_) => break,
            Ok(_) => {}
        }
        let line = buffer.trim_end();
        if line.is_empty() {
            if content_length > 0 {
                let mut body = vec![0u8; content_length];
                if tokio::io::AsyncReadExt::read_exact(&mut reader, &mut body)
                    .await
                    .is_err()
                {
                    break;
                }
                if let Ok(msg) = serde_json::from_slice::<Value>(&body) {
                    if let Some(id) = msg.get("id").and_then(Value::as_u64) {
                        if msg.get("result").is_some() || msg.get("error").is_some() {
                            if let Some(tx) = pending.lock().ok().and_then(|mut p| p.remove(&id)) {
                                let _ = tx.send(msg);
                            }
                        }
                    } else if msg.get("method").and_then(Value::as_str) == Some("textDocument/publishDiagnostics") {
                        if let Some(params) = msg.get("params") {
                            if let (Some(uri), Some(diags)) = (
                                params.get("uri").and_then(Value::as_str),
                                params.get("diagnostics").and_then(Value::as_array),
                            ) {
                                let list: Vec<LspDiagnostic> = diags
                                    .iter()
                                    .filter_map(|d| {
                                        let range = d.get("range")?;
                                        let start = range.get("start")?;
                                        let end = range.get("end")?;
                                        Some(LspDiagnostic {
                                            range: LspRange {
                                                start_line: start.get("line")?.as_u64()? as u32,
                                                start_character: start.get("character")?.as_u64()? as u32,
                                                end_line: end.get("line")?.as_u64()? as u32,
                                                end_character: end.get("character")?.as_u64()? as u32,
                                            },
                                            message: d.get("message")?.as_str()?.to_string(),
                                            severity: d.get("severity").and_then(Value::as_u64).map(|u| u as u32),
                                            source: d.get("source").and_then(Value::as_str).map(String::from),
                                        })
                                    })
                                    .collect();
                                let mut d = diagnostics.write().await;
                                d.insert(uri.to_string(), list);
                            }
                        }
                    }
                }
            }
            content_length = 0;
            continue;
        }
        if let Some(stripped) = line.strip_prefix("Content-Length: ") {
            if let Ok(n) = stripped.trim().parse::<usize>() {
                content_length = n;
            }
        }
    }
}

async fn ensure_session(workspace_root: &str, first_uri: &str) -> std::result::Result<(), String> {
    let key = session_key(workspace_root, first_uri).ok_or_else(|| "No LSP server for this file type".to_string())?;
    let mut sessions = SESSIONS.write().await;
    if sessions.contains_key(&key) {
        return Ok(());
    }
    let (cmd_name, args) = server_command_for_path(first_uri)
        .ok_or_else(|| "No LSP server for this file type".to_string())?;
    let mut child = Command::new(cmd_name)
        .args(&args)
        .current_dir(workspace_root)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn LSP: {}", e))?;
    let stdin = child.stdin.take().ok_or("No stdin")?;
    let stdout = child.stdout.take().ok_or("No stdout")?;
    let reader = BufReader::new(stdout);
    let pending = Arc::new(std::sync::Mutex::new(HashMap::new()));
    let diagnostics = Arc::new(RwLock::new(HashMap::new()));
    let pending_clone = pending.clone();
    let diagnostics_clone = diagnostics.clone();
    let reader_handle = tokio::spawn(async move {
        read_loop(reader, pending_clone, diagnostics_clone).await;
    });
    let session = Arc::new(LspSession {
        _child: child,
        stdin: Arc::new(Mutex::new(Some(stdin))),
        pending,
        diagnostics: diagnostics.clone(),
        _reader_handle: reader_handle,
    });
    sessions.insert(key.clone(), session.clone());
    drop(sessions);

    let root_uri = Url::parse(&path_to_uri(workspace_root)).map_err(|e| e.to_string())?;
    let init_params = InitializeParams {
        workspace_folders: Some(vec![lsp_types::WorkspaceFolder {
            uri: root_uri,
            name: std::path::Path::new(workspace_root)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("workspace")
                .to_string(),
        }]),
        client_info: Some(lsp_types::ClientInfo {
            name: "kode".to_string(),
            version: Some("0.1.0".to_string()),
        }),
        ..Default::default()
    };
    let params = serde_json::to_value(init_params).map_err(|e| e.to_string())?;
    let _result = session.send_request("initialize", params).await?;
    session
        .send_raw(&serde_json::json!({
            "jsonrpc": "2.0",
            "method": "initialized",
            "params": {}
        }))
        .await?;
    Ok(())
}

/// Notify LSP that a document was opened. Call after open_buffer.
pub async fn notify_did_open(buffer_id: String) -> std::result::Result<(), String> {
    let content = {
        let map = MANAGER.read().await;
        let buf = map.get(&buffer_id).ok_or("Buffer not found")?;
        let b = buf.read().await;
        b.rope.to_string()
    };
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    ensure_session(&workspace_root, &buffer_id).await?;
    let key = session_key(&workspace_root, &buffer_id).ok_or("No session key")?;
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned().ok_or("Session not found")?
    };
    let params = DidOpenTextDocumentParams {
        text_document: TextDocumentItem {
            uri: Url::parse(&uri).map_err(|e| e.to_string())?,
            language_id: language_id_for_path(&buffer_id),
            version: 0,
            text: content,
        },
    };
    let msg = serde_json::to_value(params).map_err(|e| e.to_string())?;
    session
        .send_raw(&serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didOpen",
            "params": msg
        }))
        .await?;
    Ok(())
}

fn language_id_for_path(path: &str) -> String {
    let ext = Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "ts" => "typescript".to_string(),
        "tsx" => "typescriptreact".to_string(),
        "js" => "javascript".to_string(),
        "jsx" => "javascriptreact".to_string(),
        "rs" => "rust".to_string(),
        "py" => "python".to_string(),
        _ => ext,
    }
}

/// Notify LSP that a document changed. Call after edit_buffer.
pub async fn notify_did_change(buffer_id: String, version: u64, content: String) -> std::result::Result<(), String> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = match session_key(&workspace_root, &buffer_id) {
        Some(k) => k,
        None => return Ok(()),
    };
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    let s = match session {
        Some(s) => s,
        None => return Ok(()),
    };
    let params = DidChangeTextDocumentParams {
        text_document: VersionedTextDocumentIdentifier {
            uri: Url::parse(&uri).map_err(|e| e.to_string())?,
            version: version as i32,
        },
        content_changes: vec![TextDocumentContentChangeEvent {
            range: None,
            range_length: None,
            text: content,
        }],
    };
    let msg = serde_json::to_value(params).map_err(|e| e.to_string())?;
    s.send_raw(&serde_json::json!({
        "jsonrpc": "2.0",
        "method": "textDocument/didChange",
        "params": msg
    }))
    .await?;
    Ok(())
}

/// Notify LSP that a document was closed.
pub async fn notify_did_close(buffer_id: String) -> std::result::Result<(), String> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = match session_key(&workspace_root, &buffer_id) {
        Some(k) => k,
        None => return Ok(()),
    };
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    if let Some(s) = session {
        let msg = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "textDocument/didClose",
            "params": {
                "textDocument": { "uri": uri }
            }
        });
        s.send_raw(&msg).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn lsp_has_session(buffer_id: String) -> bool {
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = match session_key(&workspace_root, &buffer_id) {
        Some(k) => k,
        None => return false,
    };
    let sessions = SESSIONS.read().await;
    sessions.contains_key(&key)
}

#[tauri::command]
pub async fn lsp_get_diagnostics(buffer_id: String) -> Result<Vec<LspDiagnostic>> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = match session_key(&workspace_root, &buffer_id) {
        Some(k) => k,
        None => return Ok(vec![]),
    };
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    let s = match session {
        Some(s) => s,
        None => return Ok(vec![]),
    };
    let diag = s.diagnostics.read().await;
    Ok(diag.get(&uri).cloned().unwrap_or_default())
}

#[tauri::command]
pub async fn lsp_goto_definition(
    buffer_id: String,
    line: u32,
    character: u32,
) -> Result<Option<Vec<LspLocation>>> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = session_key(&workspace_root, &buffer_id)
        .ok_or_else(|| EditorError::Io("No LSP server for this file type".to_string()))?;
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    let s = session
        .ok_or_else(|| EditorError::Io("LSP not running for this workspace".to_string()))?;
    let params = GotoDefinitionParams {
        text_document_position_params: TextDocumentPositionParams {
            text_document: lsp_types::TextDocumentIdentifier {
                uri: Url::parse(&uri).map_err(|e| EditorError::Io(e.to_string()))?,
            },
            position: Position {
                line: line,
                character: character,
            },
        },
        partial_result_params: Default::default(),
        work_done_progress_params: Default::default(),
    };
    let params_value = serde_json::to_value(params).map_err(|e| EditorError::Io(e.to_string()))?;
    let result = s
        .send_request("textDocument/definition", params_value)
        .await
        .map_err(|e| EditorError::Io(e.to_string()))?;
    let locations = match result {
        Value::Null => None,
        Value::Array(arr) => {
            let list: Vec<LspLocation> = arr
                .into_iter()
                .filter_map(|v| {
                    let loc = v.get("uri").and_then(Value::as_str)?;
                    let range = v.get("range")?;
                    let start = range.get("start")?;
                    let end = range.get("end")?;
                    Some(LspLocation {
                        path: uri_to_path(loc),
                        start_line: start.get("line")?.as_u64()? as u32,
                        start_character: start.get("character")?.as_u64()? as u32,
                        end_line: end.get("line")?.as_u64()? as u32,
                        end_character: end.get("character")?.as_u64()? as u32,
                    })
                })
                .collect();
            if list.is_empty() {
                None
            } else {
                Some(list)
            }
        }
        Value::Object(_) => {
            let loc = match result.get("uri").and_then(Value::as_str) {
                Some(l) => l,
                None => return Ok(None),
            };
            let range = match result.get("range") {
                Some(r) => r,
                None => return Ok(None),
            };
            let start = match range.get("start") {
                Some(s) => s,
                None => return Ok(None),
            };
            let end = match range.get("end") {
                Some(e) => e,
                None => return Ok(None),
            };
            let (sl, sc) = (
                start.get("line").and_then(Value::as_u64).map(|u| u as u32),
                start.get("character").and_then(Value::as_u64).map(|u| u as u32),
            );
            let (el, ec) = (
                end.get("line").and_then(Value::as_u64).map(|u| u as u32),
                end.get("character").and_then(Value::as_u64).map(|u| u as u32),
            );
            match (sl, sc, el, ec) {
                (Some(start_line), Some(start_character), Some(end_line), Some(end_character)) => {
                    Some(vec![LspLocation {
                        path: uri_to_path(loc),
                        start_line,
                        start_character,
                        end_line,
                        end_character,
                    }])
                }
                _ => None,
            }
        }
        _ => None,
    };
    Ok(locations)
}

#[tauri::command]
pub async fn lsp_hover(buffer_id: String, line: u32, character: u32) -> Result<Option<LspHoverResult>> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = session_key(&workspace_root, &buffer_id)
        .ok_or_else(|| EditorError::Io("No LSP server for this file type".to_string()))?;
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    let s = session
        .ok_or_else(|| EditorError::Io("LSP not running for this workspace".to_string()))?;
    let params = HoverParams {
        text_document_position_params: TextDocumentPositionParams {
            text_document: lsp_types::TextDocumentIdentifier {
                uri: Url::parse(&uri).map_err(|e| EditorError::Io(e.to_string()))?,
            },
            position: Position { line, character },
        },
        work_done_progress_params: Default::default(),
    };
    let params_value = serde_json::to_value(params).map_err(|e| EditorError::Io(e.to_string()))?;
    let result = s.send_request("textDocument/hover", params_value).await;
    let result = match result {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };
    let contents = match result {
        Value::Null => return Ok(None),
        Value::Object(o) => {
            let contents = match o.get("contents") {
                Some(c) => c,
                None => return Ok(None),
            };
            match contents {
                Value::String(s) => s.clone(),
                Value::Object(m) => {
                    if let Some(Value::String(s)) = m.get("value") {
                        s.clone()
                    } else {
                        serde_json::to_string(contents).unwrap_or_default()
                    }
                }
                Value::Array(arr) => arr
                    .iter()
                    .filter_map(|v| v.get("value").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("\n"),
                _ => return Ok(None),
            }
        }
        _ => return Ok(None),
    };
    Ok(Some(LspHoverResult { contents }))
}

#[tauri::command]
pub async fn lsp_completion(
    buffer_id: String,
    line: u32,
    character: u32,
) -> Result<Option<Vec<LspCompletionItem>>> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = session_key(&workspace_root, &buffer_id)
        .ok_or_else(|| EditorError::Io("No LSP server for this file type".to_string()))?;
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    let s = session
        .ok_or_else(|| EditorError::Io("LSP not running for this workspace".to_string()))?;
    let params = CompletionParams {
        text_document_position: TextDocumentPositionParams {
            text_document: lsp_types::TextDocumentIdentifier {
                uri: Url::parse(&uri).map_err(|e| EditorError::Io(e.to_string()))?,
            },
            position: Position { line, character },
        },
        context: None,
        partial_result_params: Default::default(),
        work_done_progress_params: Default::default(),
    };
    let params_value = serde_json::to_value(params).map_err(|e| EditorError::Io(e.to_string()))?;
    let result = s
        .send_request("textDocument/completion", params_value)
        .await
        .map_err(|e| EditorError::Io(e.to_string()))?;
    let items = match result {
        Value::Null => return Ok(None),
        Value::Object(o) => {
            let list = match o.get("items").and_then(Value::as_array) {
                Some(l) => l,
                None => return Ok(None),
            };
            let out: Vec<LspCompletionItem> = list
                .iter()
                .filter_map(|v| {
                    Some(LspCompletionItem {
                        label: v.get("label")?.as_str()?.to_string(),
                        kind: v.get("kind").and_then(Value::as_u64).map(|u| u as u32),
                        detail: v.get("detail").and_then(Value::as_str).map(String::from),
                        insert_text: v
                            .get("insertText")
                            .or_else(|| v.get("label"))
                            .and_then(Value::as_str)
                            .map(String::from),
                    })
                })
                .collect();
            Some(out)
        }
        Value::Array(arr) => {
            let out: Vec<LspCompletionItem> = arr
                .iter()
                .filter_map(|v| {
                    Some(LspCompletionItem {
                        label: v.get("label")?.as_str()?.to_string(),
                        kind: v.get("kind").and_then(Value::as_u64).map(|u| u as u32),
                        detail: v.get("detail").and_then(Value::as_str).map(String::from),
                        insert_text: v
                            .get("insertText")
                            .or_else(|| v.get("label"))
                            .and_then(Value::as_str)
                            .map(String::from),
                    })
                })
                .collect();
            Some(out)
        }
        _ => None,
    };
    Ok(items)
}

/// Request signature help from LSP.
#[tauri::command]
pub async fn lsp_signature_help(
    buffer_id: String,
    line: u32,
    character: u32,
) -> Result<Option<LspSignatureHelp>> {
    let uri = path_to_uri(&buffer_id);
    let workspace_root = workspace_root_from_path(&buffer_id);
    let key = session_key(&workspace_root, &buffer_id)
        .ok_or_else(|| EditorError::Io("No LSP server for this file type".to_string()))?;
    let session = {
        let sessions = SESSIONS.read().await;
        sessions.get(&key).cloned()
    };
    let s = session
        .ok_or_else(|| EditorError::Io("LSP not running for this workspace".to_string()))?;

    let params = SignatureHelpParams {
        text_document_position_params: TextDocumentPositionParams {
            text_document: lsp_types::TextDocumentIdentifier {
                uri: Url::parse(&uri).map_err(|e| EditorError::Io(e.to_string()))?,
            },
            position: Position { line, character },
        },
        context: None,
        work_done_progress_params: Default::default(),
    };

    let params_value = serde_json::to_value(params).map_err(|e| EditorError::Io(e.to_string()))?;
    let result = s
        .send_request("textDocument/signatureHelp", params_value)
        .await
        .map_err(|e| EditorError::Io(e.to_string()))?;

    // Parse the signature help response
    match result {
        Value::Null => Ok(None),
        Value::Object(obj) => {
            let signatures_arr = match obj.get("signatures").and_then(Value::as_array) {
                Some(arr) => arr,
                None => return Ok(None),
            };

            let signatures: Vec<LspSignatureInformation> = signatures_arr
                .iter()
                .filter_map(|sig_val| {
                    let label = sig_val.get("label")?.as_str()?.to_string();
                    let documentation = sig_val
                        .get("documentation")
                        .and_then(|doc| {
                            // Handle both string and MarkupContent
                            if let Some(s) = doc.as_str() {
                                Some(s.to_string())
                            } else if let Some(obj) = doc.as_object() {
                                obj.get("value").and_then(Value::as_str).map(String::from)
                            } else {
                                None
                            }
                        });

                    let parameters = sig_val.get("parameters").and_then(|params| {
                        let params_arr = params.as_array()?;
                        let params_vec: Vec<LspParameterInformation> = params_arr
                            .iter()
                            .filter_map(|param_val| {
                                let param_label = param_val.get("label")?;
                                let label_str = if let Some(s) = param_label.as_str() {
                                    s.to_string()
                                } else if let Some(arr) = param_label.as_array() {
                                    // Handle [start, end] tuple format
                                    if arr.len() == 2 {
                                        // Extract substring from signature label
                                        let start = arr[0].as_u64()? as usize;
                                        let end = arr[1].as_u64()? as usize;
                                        label.get(start..end)?.to_string()
                                    } else {
                                        return None;
                                    }
                                } else {
                                    return None;
                                };

                                let documentation = param_val
                                    .get("documentation")
                                    .and_then(|doc| {
                                        if let Some(s) = doc.as_str() {
                                            Some(s.to_string())
                                        } else if let Some(obj) = doc.as_object() {
                                            obj.get("value").and_then(Value::as_str).map(String::from)
                                        } else {
                                            None
                                        }
                                    });

                                Some(LspParameterInformation {
                                    label: label_str,
                                    documentation,
                                })
                            })
                            .collect();
                        if params_vec.is_empty() {
                            None
                        } else {
                            Some(params_vec)
                        }
                    });

                    Some(LspSignatureInformation {
                        label,
                        documentation,
                        parameters,
                    })
                })
                .collect();

            if signatures.is_empty() {
                return Ok(None);
            }

            let active_signature = obj
                .get("activeSignature")
                .and_then(Value::as_u64)
                .map(|u| u as u32);
            let active_parameter = obj
                .get("activeParameter")
                .and_then(Value::as_u64)
                .map(|u| u as u32);

            Ok(Some(LspSignatureHelp {
                signatures,
                active_signature,
                active_parameter,
            }))
        }
        _ => Ok(None),
    }
}
