//! LSP client: spawn language servers over stdio, sync buffers from rope,
//! expose diagnostics and goto definition via Tauri commands.

pub mod client;

pub use client::{
    lsp_has_session, lsp_get_diagnostics, lsp_goto_definition, lsp_hover, lsp_completion,
    notify_did_open, notify_did_change, notify_did_close,
};
