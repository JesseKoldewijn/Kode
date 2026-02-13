# Kode - LSP Integration TODOs

This document tracks the remaining tasks and future enhancements for the LSP integration layer.

## Current Status

**Branch:** `custom-lsp-layer`  
**Last Updated:** 2026-02-13  
**Test Coverage:** 725/726 tests passing (99.86%)

---

## ✅ Completed Features

### Core LSP Protocol
- [x] LSP Client Infrastructure (session management, JSON-RPC)
- [x] Hover (`textDocument/hover`)
- [x] Completion (`textDocument/completion`)
- [x] Signature Help (`textDocument/signatureHelp`)
- [x] Goto Definition (`textDocument/definition`)
- [x] Diagnostics (`textDocument/publishDiagnostics` - event-driven)
- [x] Did Save (`textDocument/didSave`)
- [x] Shutdown/Exit Lifecycle (`shutdown` + `exit`)
- [x] Find All References (`textDocument/references`)
- [x] Rename Symbol (`textDocument/rename` + `textDocument/prepareRename`)
- [x] Client Capabilities Declaration

### Testing
- [x] Mock system for all LSP features
- [x] Unit tests for shutdown (13 tests)
- [x] Unit tests for references (19 tests)
- [x] Unit tests for rename (14 tests)
- [x] Integration tests for existing features

---

## 🔨 High Priority Tasks

### 1. UI Integration for New Features

#### 1.1 References Panel
**Status:** Not started  
**Priority:** High  
**Effort:** Medium

Create UI component to display reference results:
- [ ] Create `ReferencesPanel.ripple` component
- [ ] Display list of references with file paths
- [ ] Show code preview for each reference
- [ ] Click to navigate to reference location
- [ ] Keyboard navigation (arrow keys)
- [ ] Add to `RustEditor.ripple` with Shift+F12 keybinding
- [ ] Add tests for references panel

**Files to modify:**
- `src/components/editor/ReferencesPanel.ripple` (new)
- `src/components/editor/RustEditor.ripple`

#### 1.2 Rename Dialog
**Status:** Not started  
**Priority:** High  
**Effort:** Medium

Create rename dialog for symbol renaming:
- [ ] Create `RenameDialog.ripple` component
- [ ] Input field with current symbol name prefilled
- [ ] Preview of changes before applying
- [ ] Apply/Cancel buttons
- [ ] F2 keybinding in `RustEditor.ripple`
- [ ] Call `lsp_prepare_rename` to validate
- [ ] Call `lsp_rename` to get workspace edit
- [ ] Apply workspace edit to all affected files
- [ ] Add tests for rename dialog

**Files to modify:**
- `src/components/editor/RenameDialog.ripple` (new)
- `src/components/editor/RustEditor.ripple`
- `src/lib/workspace.ts` (apply workspace edits)

#### 1.3 Shutdown on App Close
**Status:** Not started  
**Priority:** High  
**Effort:** Low

Ensure LSP servers shut down gracefully when app closes:
- [ ] Add Tauri window close event listener
- [ ] Call `EditorEngine.lspShutdownAll()` on close
- [ ] Add timeout to prevent hanging (max 5 seconds)
- [ ] Log shutdown status
- [ ] Test with multiple LSP servers running

**Files to modify:**
- `src/App.ripple` or `src/main.ts`

---

## 🎯 Medium Priority Tasks

### 2. Code Actions Support

**Status:** Not started  
**Priority:** Medium  
**Effort:** High

Implement `textDocument/codeAction` for quick fixes:

#### 2.1 Backend Implementation
- [ ] Add `lsp_code_action` command in `src-tauri/src/lsp/client.rs`
- [ ] Define `LspCodeAction` type
- [ ] Parse code action response (Command vs CodeAction)
- [ ] Support code action kinds (quickfix, refactor, etc.)

#### 2.2 Frontend Implementation
- [ ] Add `getLspCodeActions()` wrapper in `editor-engine.ts`
- [ ] Create mock implementation for testing
- [ ] Add to mock command list

#### 2.3 UI Implementation
- [ ] Create `CodeActionMenu.ripple` component
- [ ] Lightbulb icon when actions available
- [ ] Show menu on Ctrl/Cmd+. keybinding
- [ ] List available actions
- [ ] Execute selected action (apply edit or run command)
- [ ] Add tests for code actions

**Estimated Lines of Code:** ~300 Rust + ~200 TypeScript + ~150 tests

---

## 📋 Low Priority / Future Enhancements

### 3. Document Symbols

**Status:** Not started  
**Priority:** Low  
**Effort:** Medium

Show outline of current file:
- [ ] Implement `textDocument/documentSymbol`
- [ ] Create `SymbolOutline.ripple` sidebar panel
- [ ] Display hierarchical symbol tree
- [ ] Click to navigate to symbol
- [ ] Ctrl/Cmd+Shift+O to open symbol search

### 4. Workspace Symbols

**Status:** Not started  
**Priority:** Low  
**Effort:** Medium

Search symbols across entire workspace:
- [ ] Implement `workspace/symbol`
- [ ] Add to command palette
- [ ] Display results with file paths
- [ ] Fuzzy search support

### 5. Inlay Hints

**Status:** Not started  
**Priority:** Low  
**Effort:** Medium

Show inline type hints and parameter names:
- [ ] Implement `textDocument/inlayHint`
- [ ] Render hints in editor viewport
- [ ] Add toggle setting
- [ ] Configure hint types (types, parameters, etc.)

### 6. Go to Type Definition

**Status:** Not started  
**Priority:** Low  
**Effort:** Low

Navigate to type definition:
- [ ] Implement `textDocument/typeDefinition`
- [ ] Add Ctrl/Cmd+Shift+T keybinding
- [ ] Reuse goto definition UI

### 7. Go to Implementation

**Status:** Not started  
**Priority:** Low  
**Effort:** Low

Navigate to implementation(s):
- [ ] Implement `textDocument/implementation`
- [ ] Add Ctrl/Cmd+F12 keybinding
- [ ] Show list if multiple implementations

### 8. Go to Declaration

**Status:** Not started  
**Priority:** Low  
**Effort:** Low

Navigate to declaration (vs definition):
- [ ] Implement `textDocument/declaration`
- [ ] Distinguish from definition in UI

### 9. Document Formatting

**Status:** Not started  
**Priority:** Low  
**Effort:** Medium

Format entire document or selection:
- [ ] Implement `textDocument/formatting`
- [ ] Implement `textDocument/rangeFormatting`
- [ ] Add Shift+Alt+F keybinding
- [ ] Apply formatting changes

### 10. Call Hierarchy

**Status:** Not started  
**Priority:** Low  
**Effort:** High

Show incoming/outgoing calls:
- [ ] Implement `textDocument/prepareCallHierarchy`
- [ ] Implement `callHierarchy/incomingCalls`
- [ ] Implement `callHierarchy/outgoingCalls`
- [ ] Create call hierarchy UI

---

## 🧪 Testing Improvements

### Test Coverage Enhancements
- [ ] Add E2E tests for LSP features with real servers
- [ ] Test TypeScript LSP server integration
- [ ] Test Rust LSP server (rust-analyzer) integration
- [ ] Test Python LSP server (Pyright) integration
- [ ] Performance tests for large files (10,000+ lines)
- [ ] Stress tests with multiple LSP sessions

### Mock System Improvements
- [ ] Add more realistic mock data
- [ ] Support cross-file references in mocks
- [ ] Mock import/export resolution
- [ ] Mock project-wide symbols

---

## 📚 Documentation

### Code Documentation
- [ ] Add JSDoc comments to all LSP functions
- [ ] Document LSP client architecture
- [ ] Add Rust doc comments
- [ ] Create architecture diagram

### User Documentation
- [ ] Update README with LSP features
- [ ] Create LSP configuration guide
- [ ] Document keyboard shortcuts
- [ ] Add troubleshooting section

### Developer Documentation
- [ ] Add CONTRIBUTING.md with LSP guidelines
- [ ] Document mock system usage
- [ ] Create LSP testing guide
- [ ] Add examples for adding new LSP features

---

## 🐛 Known Issues

### Current Bugs
- None reported (all 725/726 tests passing)

### Potential Issues
- [ ] Test LSP server lifecycle with long-running sessions
- [ ] Verify memory cleanup on session shutdown
- [ ] Test with workspace containing 1000+ files
- [ ] Test rapid open/close of files

---

## 🚀 Performance Optimizations

### LSP Client Performance
- [ ] Implement request debouncing (hover, completion)
- [ ] Add request cancellation for outdated requests
- [ ] Cache LSP results (diagnostics, symbols)
- [ ] Implement incremental document sync
- [ ] Batch multiple edits into single notification

### UI Performance
- [ ] Virtual scrolling for large reference lists
- [ ] Lazy loading for symbol outlines
- [ ] Debounce diagnostics rendering
- [ ] Optimize diagnostic gutter rendering

---

## 🔧 Infrastructure Improvements

### LSP Server Management
- [ ] Auto-install LSP servers on first use
- [ ] LSP server version management
- [ ] Configuration UI for LSP settings
- [ ] Per-project LSP configuration
- [ ] Support for LSP workspace folders

### Multi-Language Support
- [ ] Add Go LSP server support
- [ ] Add C/C++ LSP server support (clangd)
- [ ] Add Java LSP server support
- [ ] Add more language servers from config

### Error Handling
- [ ] Better error messages for LSP failures
- [ ] Retry logic for failed requests
- [ ] Fallback gracefully when LSP unavailable
- [ ] User notifications for LSP errors

---

## 📊 Metrics & Analytics

### LSP Usage Tracking (Optional)
- [ ] Track which LSP features are used most
- [ ] Measure LSP response times
- [ ] Log LSP errors for debugging
- [ ] Performance metrics dashboard

---

## 🎨 UI/UX Improvements

### Visual Enhancements
- [ ] Loading indicators for LSP requests
- [ ] Better hover tooltips styling
- [ ] Completion item icons by type
- [ ] Syntax highlighting in hover content
- [ ] Diagnostic severity icons

### User Experience
- [ ] Keyboard shortcuts cheatsheet
- [ ] LSP status indicator in status bar
- [ ] Progress indicator for long operations
- [ ] Inline rename preview
- [ ] Breadcrumb navigation

---

## 🔐 Security & Stability

### Security Considerations
- [ ] Validate LSP server executables
- [ ] Sandboxing for LSP processes
- [ ] Limit LSP server resource usage
- [ ] Audit LSP server permissions

### Stability
- [ ] Handle LSP server crashes gracefully
- [ ] Implement health checks
- [ ] Auto-restart crashed servers
- [ ] Rate limiting for LSP requests

---

## 📦 Release Preparation

### Before Merging to Main
- [ ] Complete UI integration (references, rename, shutdown)
- [ ] Full E2E test pass with real LSP servers
- [ ] Update CHANGELOG.md
- [ ] Create migration guide
- [ ] Performance benchmarking
- [ ] Security review

### Post-Merge Tasks
- [ ] User acceptance testing
- [ ] Monitor for LSP-related issues
- [ ] Gather user feedback
- [ ] Iterate on UX improvements

---

## 💡 Ideas for Future Exploration

### Advanced Features
- [ ] Semantic highlighting
- [ ] Code lens support
- [ ] Selection range
- [ ] Linked editing
- [ ] Type hierarchy
- [ ] Document links
- [ ] Color picker for CSS colors
- [ ] Folding ranges from LSP

### Integration Features
- [ ] AI-powered code actions
- [ ] LSP-based code search
- [ ] Cross-project references
- [ ] Language server plugins
- [ ] Custom LSP extensions

---

## 📝 Notes

### Important Considerations
- Always maintain backward compatibility
- Ensure all new features have comprehensive tests
- Follow TDD approach for new implementations
- Update mock system for all new LSP features
- Keep documentation in sync with code

### Testing Strategy
- Unit tests for mock system
- Integration tests for IPC layer
- E2E tests for UI interactions
- Performance tests for large codebases

### Code Quality Goals
- Maintain >95% test coverage
- Zero compiler warnings
- All E2E tests passing
- Clean git history with descriptive commits

---

## 📞 Contact

For questions or suggestions about LSP integration:
- Create an issue on GitHub
- Discuss in project Discord/Slack
- Review existing LSP documentation at https://microsoft.github.io/language-server-protocol/

---

**Last Updated:** 2026-02-13  
**Branch:** `custom-lsp-layer`  
**Test Status:** 725/726 passing (99.86%)
