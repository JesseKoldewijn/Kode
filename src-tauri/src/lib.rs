// Kode - Tauri Application
// A Cursor-like code editor with AI chat support

pub mod commands;
pub mod editor;
pub mod lsp;

use tauri::{
    menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    Emitter, Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Build the native menu bar
            let handle = app.handle();

            // -- File menu --
            let file_new = MenuItemBuilder::with_id("file.newFile", "New File")
                .accelerator("CmdOrCtrl+N")
                .build(handle)?;
            let file_open = MenuItemBuilder::with_id("file.openFile", "Open File...")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?;
            let file_save = MenuItemBuilder::with_id("file.save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(handle)?;
            let file_save_as = MenuItemBuilder::with_id("file.saveAs", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(handle)?;
            let file_close = MenuItemBuilder::with_id("file.close", "Close Tab")
                .accelerator("CmdOrCtrl+W")
                .build(handle)?;

            let file_menu = SubmenuBuilder::new(handle, "File")
                .items(&[
                    &file_new,
                    &file_open,
                    &PredefinedMenuItem::separator(handle)?,
                    &file_save,
                    &file_save_as,
                    &PredefinedMenuItem::separator(handle)?,
                    &file_close,
                ])
                .build()?;

            // -- Edit menu --
            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .items(&[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &MenuItemBuilder::with_id("edit.find", "Find")
                        .accelerator("CmdOrCtrl+F")
                        .build(handle)?,
                    &MenuItemBuilder::with_id("edit.findReplace", "Find and Replace")
                        .accelerator("CmdOrCtrl+H")
                        .build(handle)?,
                ])
                .build()?;

            // -- View menu --
            let view_sidebar = MenuItemBuilder::with_id("view.toggleSidebar", "Toggle Sidebar")
                .accelerator("CmdOrCtrl+B")
                .build(handle)?;
            let view_panel = MenuItemBuilder::with_id("view.togglePanel", "Toggle Panel")
                .accelerator("CmdOrCtrl+J")
                .build(handle)?;
            let view_chat = MenuItemBuilder::with_id("view.toggleChat", "Toggle Chat")
                .accelerator("CmdOrCtrl+Shift+B")
                .build(handle)?;
            let view_palette = MenuItemBuilder::with_id("view.commandPalette", "Command Palette")
                .accelerator("CmdOrCtrl+Shift+P")
                .build(handle)?;
            let view_quick_open = MenuItemBuilder::with_id("view.quickOpen", "Quick Open")
                .accelerator("CmdOrCtrl+P")
                .build(handle)?;
            let view_fullscreen =
                MenuItemBuilder::with_id("view.toggleFullscreen", "Toggle Fullscreen")
                    .accelerator("F11")
                    .build(handle)?;
            let view_zoom_in = MenuItemBuilder::with_id("view.zoomIn", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .build(handle)?;
            let view_zoom_out = MenuItemBuilder::with_id("view.zoomOut", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .build(handle)?;
            let view_zoom_reset = MenuItemBuilder::with_id("view.resetZoom", "Reset Zoom")
                .accelerator("CmdOrCtrl+0")
                .build(handle)?;
            let view_word_wrap =
                MenuItemBuilder::with_id("editor.toggleWordWrap", "Toggle Word Wrap")
                    .accelerator("Alt+Z")
                    .build(handle)?;

            let view_menu = SubmenuBuilder::new(handle, "View")
                .items(&[
                    &view_sidebar,
                    &view_panel,
                    &view_chat,
                    &PredefinedMenuItem::separator(handle)?,
                    &view_palette,
                    &view_quick_open,
                    &PredefinedMenuItem::separator(handle)?,
                    &view_fullscreen,
                    &PredefinedMenuItem::separator(handle)?,
                    &view_zoom_in,
                    &view_zoom_out,
                    &view_zoom_reset,
                    &PredefinedMenuItem::separator(handle)?,
                    &view_word_wrap,
                ])
                .build()?;

            // -- Terminal menu --
            let terminal_toggle = MenuItemBuilder::with_id("terminal.toggle", "Toggle Terminal")
                .accelerator("CmdOrCtrl+`")
                .build(handle)?;
            let terminal_new = MenuItemBuilder::with_id("terminal.new", "New Terminal")
                .accelerator("CmdOrCtrl+Shift+`")
                .build(handle)?;

            let terminal_menu = SubmenuBuilder::new(handle, "Terminal")
                .items(&[&terminal_toggle, &terminal_new])
                .build()?;

            // -- Help menu --
            let help_settings = MenuItemBuilder::with_id("help.openSettings", "Settings")
                .accelerator("CmdOrCtrl+,")
                .build(handle)?;
            let help_keybindings =
                MenuItemBuilder::with_id("help.openKeybindings", "Keyboard Shortcuts")
                    .accelerator("CmdOrCtrl+K CmdOrCtrl+S")
                    .build(handle)?;
            let help_about =
                MenuItemBuilder::with_id("help.showAbout", "About Kode").build(handle)?;

            let help_menu = SubmenuBuilder::new(handle, "Help")
                .items(&[
                    &help_settings,
                    &help_keybindings,
                    &PredefinedMenuItem::separator(handle)?,
                    &help_about,
                ])
                .build()?;

            let menu = Menu::with_items(
                handle,
                &[
                    &file_menu,
                    &edit_menu,
                    &view_menu,
                    &terminal_menu,
                    &help_menu,
                ],
            )?;

            app.set_menu(menu)?;

            // Initialize logging
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Debug)
                        .build(),
                )?;
            }

            // Get the main window for devtools
            #[cfg(debug_assertions)]
            {
                if let Some(window) = app.get_webview_window("main") {
                    log::info!("Opening devtools (debug mode)...");
                    window.open_devtools();
                } else {
                    log::warn!("Could not get main window for devtools");
                }
            }

            // Initialize LSP client with AppHandle for event emission
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                crate::lsp::client::set_app_handle(app_handle).await;
            });

            log::info!("Kode started successfully");
            Ok(())
        })
        .on_menu_event(|app, event| {
            let action_id = event.id().0.as_str();
            // Emit menu action to frontend so the keybinding system can handle it
            if let Err(e) = app.emit("menu-action", action_id) {
                log::error!("Failed to emit menu action '{}': {}", action_id, e);
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::filesystem::read_directory,
            commands::filesystem::read_file,
            commands::filesystem::write_file,
            commands::filesystem::create_file,
            commands::filesystem::create_directory,
            commands::filesystem::delete_path,
            commands::filesystem::rename_path,
            commands::filesystem::search_files,
            commands::filesystem::search_content,
            commands::terminal::spawn_terminal,
            commands::terminal::write_terminal,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            commands::agent::start_agent,
            commands::agent::send_to_agent,
            commands::agent::stop_agent,
            commands::watcher::start_watcher,
            commands::watcher::stop_watcher,
            commands::git::get_git_branch,
            commands::git::get_git_status,
            commands::editor::test_simple_command,
            commands::editor::open_buffer,
            commands::editor::get_buffer_info,
            commands::editor::close_buffer,
            commands::editor::search_buffer,
            commands::editor::get_highlights,
            commands::editor::get_symbols,
            commands::editor::get_fold_ranges,
            commands::editor::edit_buffer,
            commands::editor::edit_buffer_with_selections,
            commands::editor::set_selections,
            commands::editor::get_selections,
            commands::editor::undo_buffer,
            commands::editor::redo_buffer,
            commands::editor::get_history_state,
            crate::lsp::client::lsp_has_session,
            crate::lsp::client::lsp_get_diagnostics,
            crate::lsp::client::lsp_goto_definition,
            crate::lsp::client::lsp_hover,
            crate::lsp::client::lsp_completion,
            crate::lsp::client::lsp_signature_help,
            crate::lsp::client::notify_lsp_did_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kode");
}
