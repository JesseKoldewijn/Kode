# Rust Editor Engine Migration Plan

> **Goal:** Replace Monaco Editor with a custom Rust-based editor engine using `ropey` (rope text buffer) and `tree-sitter` (incremental parsing), with a hybrid architecture where Rust owns the document model and the Tauri webview handles rendering and input.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Design Decisions](#design-decisions)
- [Performance Targets](#performance-targets)
- [Phase 1: Rust Document Model + Tree-sitter Highlighting](#phase-1-rust-document-model--tree-sitter-highlighting)
- [Phase 2: Rust-Owned Editing](#phase-2-rust-owned-editing)
- [Phase 3: Custom Renderer + Monaco Removal](#phase-3-custom-renderer--monaco-removal)
- [Risk Register](#risk-register)
- [Appendix: Crate Versions](#appendix-crate-versions)

---

## Architecture Overview

```
Current Architecture (Monaco)
=============================

  Frontend (Webview)                      Rust Backend
  +-----------------------+              +--------------------+
  | Monaco Editor         |              | filesystem.rs      |
  |  - Document model     |   invoke()   |  - read_file       |
  |  - Syntax highlight   | <----------> |  - write_file      |
  |  - Undo/redo          |              |  - search_files    |
  |  - Autocomplete       |              |  - search_content  |
  |  - Cursor/selection   |              |                    |
  |  - Code folding       |              | (No editor logic)  |
  |  - Search/replace     |              |                    |
  |  - Minimap            |              |                    |
  +-----------------------+              +--------------------+

Target Architecture (Hybrid)
=============================

  Frontend (Webview)                      Rust Backend
  +-----------------------+              +----------------------------+
  | Custom Renderer       |              | editor/mod.rs              |
  |  - Virtualized        |   invoke()   |  - BufferManager           |
  |    line rendering     | <----------> |  - Rope (ropey)            |
  |  - Hidden textarea    |   + events   |  - Tree-sitter parser      |
  |    for IME input      |              |  - Undo/redo stack         |
  |  - CSS styling        |              |  - Selection model         |
  |  - Scroll mgmt        |              |  - Search engine           |
  |  - Cursor drawing     |              |  - Code folding            |
  |  - Selection          |              |  - Symbol extraction       |
  |    highlight          |              |  - Viewport highlight      |
  |                       |              |    computation             |
  | Optimistic Updates    |              |  - Diagnostics bridge      |
  |  - Instant visual     |              |                            |
  |    feedback on        |              | filesystem.rs              |
  |    keystroke          |              |  - read_file / write_file  |
  |  - Reconcile with     |              |  - search_files            |
  |    Rust state          |              |  - search_content          |
  +-----------------------+              +----------------------------+
```

### Core Principles

1. **Rust owns the truth.** The rope buffer in Rust is the single source of truth for document state. The frontend may apply optimistic updates but always reconciles against Rust state.
2. **Frontend owns input.** The webview handles all keyboard/mouse/IME input via DOM APIs (hidden `<textarea>` pattern) and sends editing commands to Rust.
3. **Frontend owns rendering.** The webview renders styled DOM elements from data provided by Rust. No canvas rendering -- we leverage the DOM for accessibility, theming, and text quality.
4. **TDD throughout.** Every Rust module is tested before implementation. Every IPC contract has integration tests. Every frontend component has unit tests. Performance budgets are enforced in CI.

---

## Design Decisions

| Decision         | Choice                                    | Rationale                                                                                                    |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Text buffer      | `ropey`                                   | Most mature rope crate (4.2M downloads), used by Helix editor, excellent API for line/char/byte indexing     |
| Parser           | `tree-sitter` + `tree-sitter-highlight`   | Incremental parsing, error recovery, used by Zed/Helix/Neovim, full language grammar coverage                |
| Rendering        | DOM-based virtualized lines               | Preserves accessibility, IME support, CSS theming compatibility with Ripple/Tailwind                         |
| Input handling   | Hidden `<textarea>`                       | Same pattern Monaco uses. Captures all keyboard input including IME composition without fighting the browser |
| Latency strategy | Optimistic updates + async reconciliation | Achieves perceived sub-8ms latency while allowing Rust processing to take up to ~5ms                         |
| Collaboration    | Not in scope                              | Single-user local editing only. Architecture allows future CRDT extension                                    |
| Language count   | 13 languages                              | JS, TS, JSON, Markdown, CSS, HTML, Rust, Python, YAML, TOML, Go, C/C++, Bash                                 |
| Monaco removal   | Full removal in Phase 3                   | Clean break. Remove all `monaco-editor`, worker configs, themes, and vite chunk config                       |

---

## Performance Targets

All targets are enforced via automated tests that run in CI.

| Metric                          | Target             | Measurement                                                                |
| ------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| **Perceived keystroke latency** | < 8ms              | Time from keydown event to visual update on screen (optimistic path)       |
| **Rust edit round-trip**        | < 5ms              | Time for `invoke('edit_buffer')` to return (rope edit + incremental parse) |
| **Highlight computation**       | < 3ms per viewport | Time for `get_highlights()` for 50 visible lines                           |
| **Buffer open (1MB file)**      | < 50ms             | Time from `invoke('open_buffer')` to first highlight data available        |
| **Buffer open (10MB file)**     | < 200ms            | Same for large files                                                       |
| **Buffer open (50MB file)**     | < 1000ms           | Same for very large files                                                  |
| **Incremental parse**           | < 2ms              | Tree-sitter re-parse after a single character edit                         |
| **Memory per buffer**           | < 2x file size     | Rope + tree-sitter tree overhead                                           |
| **Undo/redo**                   | < 1ms              | Time for a single undo/redo operation                                      |
| **Search (10MB file)**          | < 100ms            | Regex search across entire buffer                                          |
| **Symbol extraction**           | < 10ms             | Full symbol outline for a 5000-line file                                   |
| **Scroll (jump 10000 lines)**   | < 16ms             | Highlight computation for new viewport after large scroll                  |
| **Frontend render (50 lines)**  | < 4ms              | DOM update for 50 lines of highlighted content                             |
| **Total edit-to-pixels**        | < 8ms              | Full pipeline: optimistic update + CSS repaint                             |

### Benchmark Test Structure

```
src-tauri/
  benches/
    rope_operations.rs       # ropey insert/delete/search benchmarks
    tree_sitter_parse.rs     # Parse + incremental re-parse benchmarks
    highlight_compute.rs     # Viewport highlight extraction benchmarks
    buffer_manager.rs        # Full pipeline benchmarks (open, edit, highlight)
    ipc_overhead.rs          # Serialization + IPC round-trip benchmarks

tests/
  lib/
    editor-engine-perf.test.ts  # Frontend-side IPC latency benchmarks
    renderer-perf.test.ts       # DOM rendering benchmarks
```

---

## Phase 1: Rust Document Model + Tree-sitter Highlighting

**Duration estimate:** 3-5 weeks
**Goal:** Rust manages document buffers with rope + tree-sitter. Frontend still uses Monaco for editing and rendering, but receives syntax highlighting data from Rust for comparison/validation. This phase establishes the Rust editor infrastructure without disrupting the working editor.

### 1.1 Rust Crate Setup

#### 1.1.1 Add Dependencies to Cargo.toml

Add the following to `src-tauri/Cargo.toml`:

```toml
# --- Editor engine ---
ropey = "1.6"
tree-sitter = "0.24"
tree-sitter-highlight = "0.24"
tree-sitter-tags = "0.24"

# Language grammars
tree-sitter-javascript = "0.23"
tree-sitter-typescript = "0.23"
tree-sitter-json = "0.24"
tree-sitter-html = "0.23"
tree-sitter-css = "0.23"
tree-sitter-python = "0.23"
tree-sitter-rust = "0.23"
tree-sitter-markdown = "0.4"
tree-sitter-yaml = "0.7"
tree-sitter-toml-ng = "0.7"
tree-sitter-go = "0.23"
tree-sitter-c = "0.23"
tree-sitter-cpp = "0.23"
tree-sitter-bash = "0.23"

# Benchmarking
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }

[[bench]]
name = "editor_benchmarks"
harness = false
```

> **Note on tree-sitter versions:** Pin to compatible versions. The `tree-sitter` core crate and grammar crates must use compatible ABI versions. Check compatibility before finalizing exact versions. The versions listed here are indicative -- resolve the actual latest compatible set at implementation time.

#### 1.1.2 Tests First: Dependency Validation

**File:** `src-tauri/src/editor/mod.rs`

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn ropey_basic_operations() {
        use ropey::Rope;
        let rope = Rope::from_str("Hello, world!");
        assert_eq!(rope.len_chars(), 13);
        assert_eq!(rope.len_lines(), 1);
    }

    #[test]
    fn tree_sitter_loads_javascript() {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&tree_sitter_javascript::LANGUAGE.into()).unwrap();
        let tree = parser.parse("const x = 42;", None).unwrap();
        assert_eq!(tree.root_node().kind(), "program");
    }
}
```

Run: `cargo test -p kode` to validate crate integration before writing any application code.

### 1.2 Buffer Manager

The buffer manager is the core data structure that owns all open document buffers.

#### 1.2.1 Data Model

**File:** `src-tauri/src/editor/buffer.rs`

```rust
pub struct Buffer {
    pub id: String,                    // Unique buffer ID (file path or UUID for untitled)
    pub rope: Rope,                    // The text content
    pub language: LanguageId,          // Language identifier
    pub parser: Parser,                // Tree-sitter parser (configured for this language)
    pub tree: Option<Tree>,            // Current parse tree
    pub version: u64,                  // Monotonic version counter (incremented on every edit)
    pub file_path: Option<PathBuf>,    // On-disk path (None for untitled buffers)
    pub is_dirty: bool,               // Has unsaved changes
    pub line_ending: LineEnding,       // Detected line ending style
}

pub struct BufferManager {
    buffers: HashMap<String, Buffer>,
}
```

#### 1.2.2 Tests First: Buffer Lifecycle

**File:** `src-tauri/src/editor/buffer.rs` (in `#[cfg(test)]` block)

Write tests **before** implementation for:

| Test                                 | Description                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| `test_create_buffer_from_string`     | Create buffer, verify rope content, char count, line count |
| `test_create_buffer_empty`           | Create empty buffer, verify zero-length rope               |
| `test_create_buffer_large_file`      | Create buffer from 10MB string, verify content integrity   |
| `test_buffer_version_starts_at_zero` | New buffer has version 0                                   |
| `test_buffer_language_detection`     | File path to language mapping for all 13 languages         |
| `test_buffer_line_ending_detection`  | Detect LF, CRLF, CR, mixed                                 |
| `test_buffer_line_ending_large_file` | Line ending detection on 5MB file completes in < 5ms       |

#### 1.2.3 Tests First: Buffer Manager CRUD

| Test                            | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `test_open_buffer`              | Open a buffer, verify it's retrievable by ID                   |
| `test_open_buffer_duplicate`    | Opening same path twice returns existing buffer (no duplicate) |
| `test_close_buffer`             | Close a buffer, verify it's no longer retrievable              |
| `test_close_nonexistent_buffer` | Closing a non-existent buffer is a no-op (no panic)            |
| `test_get_buffer`               | Retrieve buffer by ID, verify content                          |
| `test_get_buffer_not_found`     | Get nonexistent buffer returns None                            |
| `test_list_buffers`             | List all open buffer IDs                                       |
| `test_buffer_isolation`         | Edits to one buffer don't affect another                       |

#### 1.2.4 Implementation

Implement `BufferManager` with:

- `open(id, content, file_path, language) -> Result<(), EditorError>`
- `close(id) -> Result<(), EditorError>`
- `get(id) -> Option<&Buffer>`
- `get_mut(id) -> Option<&mut Buffer>`
- `list() -> Vec<String>`
- `is_open(id) -> bool`

State management: Use `tokio::sync::RwLock<BufferManager>` as a global (via `lazy_static!` or `once_cell`), consistent with the existing terminal/agent pattern. Use `RwLock` instead of `Mutex` because reads (highlight computation, symbol queries) vastly outnumber writes (edits).

### 1.3 Language Registry

#### 1.3.1 Data Model

**File:** `src-tauri/src/editor/languages.rs`

```rust
pub enum LanguageId {
    JavaScript,
    TypeScript,
    Tsx,
    Jsx,
    Json,
    Html,
    Css,
    Rust,
    Python,
    Markdown,
    Yaml,
    Toml,
    Go,
    C,
    Cpp,
    Bash,
    Plaintext,
}

pub struct LanguageConfig {
    pub id: LanguageId,
    pub name: &'static str,             // Display name
    pub extensions: &'static [&'static str], // File extensions
    pub language: tree_sitter::Language, // Tree-sitter language
    pub highlight_query: &'static str,  // Tree-sitter highlight query
    pub injection_query: Option<&'static str>, // For embedded languages (e.g., JS in HTML)
    pub locals_query: Option<&'static str>,    // For local variable resolution
}
```

#### 1.3.2 Tests First: Language Registry

| Test                                        | Description                                               |
| ------------------------------------------- | --------------------------------------------------------- |
| `test_detect_language_from_extension`       | All 13+ languages detected correctly from file extensions |
| `test_detect_language_tsx`                  | `.tsx` maps to Tsx, not TypeScript                        |
| `test_detect_language_jsx`                  | `.jsx` maps to Jsx, not JavaScript                        |
| `test_detect_language_ripple`               | `.ripple` files map to TypeScript                         |
| `test_detect_language_unknown`              | Unknown extensions map to Plaintext                       |
| `test_detect_language_no_extension`         | Files without extensions map to Plaintext                 |
| `test_detect_language_case_insensitive`     | `.RS` and `.rs` both map to Rust                          |
| `test_all_languages_have_highlight_queries` | Every non-Plaintext language has a highlight query        |
| `test_all_parsers_initialize`               | Every language's parser initializes without panic         |
| `test_all_parsers_parse_empty_string`       | Every parser can parse an empty string                    |
| `test_highlight_query_valid`                | Every highlight query compiles without errors             |

#### 1.3.3 Implementation

- Static registry initialized once via `lazy_static!` or `OnceLock`
- `detect_language(path: &Path) -> LanguageId` function
- `get_config(lang: LanguageId) -> &LanguageConfig` function
- `create_parser(lang: LanguageId) -> Parser` factory function
- Highlight queries loaded from tree-sitter grammar crate `HIGHLIGHTS_QUERY` constants or bundled `.scm` files

### 1.4 Tree-sitter Integration

#### 1.4.1 Parsing

**File:** `src-tauri/src/editor/parsing.rs`

Handles initial parse and incremental re-parse when edits occur.

#### 1.4.2 Tests First: Parsing

| Test                                                | Description                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `test_parse_javascript`                             | Parse `const x = 42;`, verify root node is `program`                  |
| `test_parse_typescript`                             | Parse `const x: number = 42;`, verify type annotation node exists     |
| `test_parse_rust`                                   | Parse `fn main() {}`, verify `function_item` node                     |
| `test_parse_python`                                 | Parse `def hello(): pass`, verify `function_definition` node          |
| `test_parse_json`                                   | Parse `{"key": "value"}`, verify `document` root                      |
| `test_parse_html`                                   | Parse `<div>hello</div>`, verify `document` root with `element` child |
| `test_parse_css`                                    | Parse `body { color: red; }`, verify `stylesheet` root                |
| `test_parse_markdown`                               | Parse `# Hello`, verify `document` root                               |
| `test_parse_yaml`                                   | Parse `key: value`, verify parse success                              |
| `test_parse_toml`                                   | Parse `[section]\nkey = "value"`, verify parse success                |
| `test_parse_go`                                     | Parse `package main`, verify `source_file` root                       |
| `test_parse_c`                                      | Parse `int main() {}`, verify `translation_unit` root                 |
| `test_parse_cpp`                                    | Parse `#include <iostream>`, verify parse success                     |
| `test_parse_bash`                                   | Parse `#!/bin/bash\necho hello`, verify `program` root                |
| `test_parse_with_syntax_errors`                     | Parse `const x = ;`, verify tree exists with ERROR node               |
| `test_parse_empty_file`                             | Parse empty string, verify valid tree                                 |
| `test_incremental_parse_insert`                     | Insert text, re-parse with edit, verify updated tree                  |
| `test_incremental_parse_delete`                     | Delete text, re-parse with edit, verify updated tree                  |
| `test_incremental_parse_replace`                    | Replace text, re-parse with edit, verify updated tree                 |
| `test_incremental_parse_multiline_insert`           | Insert multiline text, verify line counts update                      |
| `test_incremental_parse_preserves_unaffected_nodes` | Nodes far from edit point are reused (verify via node ID stability)   |

#### 1.4.3 Performance Tests: Parsing

| Test                                  | Target      | Description                                           |
| ------------------------------------- | ----------- | ----------------------------------------------------- |
| `bench_initial_parse_small`           | < 5ms       | Parse 100-line JS file                                |
| `bench_initial_parse_medium`          | < 20ms      | Parse 1000-line JS file                               |
| `bench_initial_parse_large`           | < 100ms     | Parse 10000-line JS file                              |
| `bench_incremental_parse_single_char` | < 2ms       | Insert one character, re-parse                        |
| `bench_incremental_parse_line`        | < 2ms       | Insert one line, re-parse                             |
| `bench_incremental_parse_block`       | < 5ms       | Insert 50 lines, re-parse                             |
| `bench_parse_all_languages`           | < 10ms each | Parse a representative 500-line file in each language |

### 1.5 Highlight Engine

#### 1.5.1 Data Model

```rust
#[derive(Serialize, Clone)]
pub struct HighlightSpan {
    pub start_col: u32,     // Column offset within the line (0-based)
    pub end_col: u32,       // End column (exclusive)
    pub scope: String,      // Semantic scope (e.g., "keyword", "string", "comment", "function")
}

#[derive(Serialize)]
pub struct HighlightedLine {
    pub line_number: u32,   // 0-based line index
    pub text: String,       // The line content
    pub spans: Vec<HighlightSpan>,
}

#[derive(Serialize)]
pub struct ViewportHighlights {
    pub buffer_id: String,
    pub version: u64,       // Buffer version these highlights correspond to
    pub lines: Vec<HighlightedLine>,
    pub total_lines: u32,   // Total lines in the buffer (for scrollbar)
}
```

#### 1.5.2 Tests First: Highlighting

| Test                                    | Description                                                            |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `test_highlight_javascript_keyword`     | `const` gets scope `keyword`                                           |
| `test_highlight_javascript_string`      | `"hello"` gets scope `string`                                          |
| `test_highlight_javascript_number`      | `42` gets scope `number`                                               |
| `test_highlight_javascript_comment`     | `// comment` gets scope `comment`                                      |
| `test_highlight_javascript_function`    | `function foo()` -- `foo` gets scope `function`                        |
| `test_highlight_rust_keyword`           | `fn`, `let`, `mut` get scope `keyword`                                 |
| `test_highlight_rust_type`              | `String`, `Vec` get scope `type`                                       |
| `test_highlight_rust_attribute`         | `#[derive(Debug)]` -- `derive` gets scope `attribute`                  |
| `test_highlight_python_decorator`       | `@property` gets scope `attribute`                                     |
| `test_highlight_html_tag`               | `<div>` -- `div` gets scope `tag`                                      |
| `test_highlight_css_property`           | `color` in `color: red;` gets scope `property`                         |
| `test_highlight_json_key`               | `"key"` in object gets scope `string.special` or `property`            |
| `test_highlight_viewport_range`         | Request lines 50-100 from 500-line file, only those lines returned     |
| `test_highlight_empty_file`             | Empty file returns zero highlighted lines                              |
| `test_highlight_spans_cover_full_line`  | No gaps between spans (every character has a scope or is default text) |
| `test_highlight_multiline_string`       | Template literal spanning 3 lines is fully highlighted as string       |
| `test_highlight_multiline_comment`      | Block comment spanning 5 lines is fully highlighted as comment         |
| `test_highlight_with_syntax_errors`     | File with errors still highlights valid parts correctly                |
| `test_highlight_version_matches_buffer` | Returned version matches current buffer version                        |
| `test_highlight_after_edit`             | Edit buffer, re-request highlights, verify updated                     |

#### 1.5.3 Performance Tests: Highlighting

| Test                            | Target     | Description                                      |
| ------------------------------- | ---------- | ------------------------------------------------ |
| `bench_highlight_50_lines`      | < 3ms      | Highlight 50 lines from a 5000-line JS file      |
| `bench_highlight_100_lines`     | < 5ms      | Highlight 100 lines from a 5000-line JS file     |
| `bench_highlight_after_edit`    | < 5ms      | Edit + incremental parse + re-highlight 50 lines |
| `bench_highlight_all_languages` | < 5ms each | Highlight 50 lines of each language              |

### 1.6 Symbol Extraction

#### 1.6.1 Data Model

```rust
#[derive(Serialize)]
pub struct DocumentSymbol {
    pub name: String,
    pub kind: SymbolKind,           // Function, Class, Method, Variable, Constant, etc.
    pub start_line: u32,
    pub end_line: u32,
    pub start_col: u32,
    pub end_col: u32,
    pub children: Vec<DocumentSymbol>,
}
```

#### 1.6.2 Tests First: Symbol Extraction

| Test                                 | Description                                                 |
| ------------------------------------ | ----------------------------------------------------------- |
| `test_symbols_javascript_functions`  | Extract function declarations with correct names and ranges |
| `test_symbols_javascript_classes`    | Extract class declarations with methods as children         |
| `test_symbols_typescript_interfaces` | Extract interfaces and type aliases                         |
| `test_symbols_rust_functions`        | Extract `fn` items                                          |
| `test_symbols_rust_structs`          | Extract structs with fields                                 |
| `test_symbols_rust_impl_blocks`      | Extract impl blocks with methods as children                |
| `test_symbols_python_classes`        | Extract class definitions with methods                      |
| `test_symbols_nested`                | Correctly nest children (methods inside classes)            |
| `test_symbols_empty_file`            | No symbols for empty file                                   |
| `test_symbols_large_file`            | 5000-line file completes in < 10ms                          |

### 1.7 IPC Commands

#### 1.7.1 New Command Module

**File:** `src-tauri/src/commands/editor.rs`

Register in `src-tauri/src/commands/mod.rs`:

```rust
pub mod editor;
```

Register in `src-tauri/src/lib.rs` invoke_handler.

#### 1.7.2 Phase 1 Commands

| Command           | Signature                                                                                      | Description                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `open_buffer`     | `(path: String) -> BufferInfo`                                                                 | Read file, create rope + tree-sitter parse, return buffer metadata |
| `close_buffer`    | `(buffer_id: String) -> ()`                                                                    | Dispose buffer and free memory                                     |
| `get_highlights`  | `(buffer_id: String, start_line: u32, end_line: u32) -> ViewportHighlights`                    | Compute and return syntax highlights for a line range              |
| `get_symbols`     | `(buffer_id: String) -> Vec<DocumentSymbol>`                                                   | Extract document symbol outline                                    |
| `search_buffer`   | `(buffer_id: String, query: String, is_regex: bool, case_sensitive: bool) -> Vec<SearchMatch>` | Search within a single buffer using the rope                       |
| `get_buffer_info` | `(buffer_id: String) -> BufferInfo`                                                            | Return metadata (line count, language, version, dirty state)       |

#### 1.7.3 Return Types

```rust
#[derive(Serialize)]
pub struct BufferInfo {
    pub id: String,
    pub language: String,
    pub line_count: u32,
    pub char_count: u64,
    pub version: u64,
    pub is_dirty: bool,
    pub line_ending: String,  // "LF", "CRLF", "CR"
}

#[derive(Serialize)]
pub struct SearchMatch {
    pub line_number: u32,
    pub start_col: u32,
    pub end_col: u32,
    pub line_text: String,
    pub match_text: String,
}
```

### 1.8 Frontend Integration (Phase 1 -- Shadow Mode)

In Phase 1, the Rust editor engine runs **in parallel** with Monaco ("shadow mode"). This allows us to:

1. Validate Rust highlighting against Monaco's built-in highlighting
2. Test IPC performance with real user interaction
3. Build the integration layer without breaking the working editor

#### 1.8.1 New Frontend Module

**File:** `src/lib/editor-engine.ts`

Wraps the Rust IPC commands with a TypeScript API:

```typescript
export interface BufferInfo {
  id: string;
  language: string;
  lineCount: number;
  charCount: number;
  version: number;
  isDirty: boolean;
  lineEnding: string;
}

export interface HighlightSpan {
  startCol: number;
  endCol: number;
  scope: string;
}

export interface HighlightedLine {
  lineNumber: number;
  text: string;
  spans: HighlightSpan[];
}

export interface ViewportHighlights {
  bufferId: string;
  version: number;
  lines: HighlightedLine[];
  totalLines: number;
}

export const editorEngine = {
  openBuffer(path: string): Promise<BufferInfo>;
  closeBuffer(bufferId: string): Promise<void>;
  getHighlights(bufferId: string, startLine: number, endLine: number): Promise<ViewportHighlights>;
  getSymbols(bufferId: string): Promise<DocumentSymbol[]>;
  searchBuffer(bufferId: string, query: string, isRegex: boolean, caseSensitive: boolean): Promise<SearchMatch[]>;
  getBufferInfo(bufferId: string): Promise<BufferInfo>;
};
```

#### 1.8.2 Shadow Mode Integration

Modify `workspace.ts` to call `editorEngine.openBuffer()` when a file is opened and `editorEngine.closeBuffer()` when closed. This keeps the Rust buffer in sync without affecting Monaco.

#### 1.8.3 Frontend Tests

**File:** `tests/lib/editor-engine.test.ts`

| Test                                 | Description                                |
| ------------------------------------ | ------------------------------------------ |
| `test_open_buffer_returns_info`      | Mock IPC, verify returned BufferInfo shape |
| `test_close_buffer_succeeds`         | Mock IPC, verify no error                  |
| `test_get_highlights_returns_spans`  | Mock IPC, verify highlight data shape      |
| `test_get_symbols_returns_tree`      | Mock IPC, verify symbol tree shape         |
| `test_search_buffer_returns_matches` | Mock IPC, verify match shape               |
| `test_open_buffer_error_handling`    | Nonexistent file returns descriptive error |

**File:** `tests/lib/editor-engine-perf.test.ts`

| Test                             | Description                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `test_ipc_roundtrip_latency`     | Measure `invoke('open_buffer')` latency (requires Tauri runtime -- E2E only) |
| `test_highlight_request_latency` | Measure `invoke('get_highlights')` latency                                   |

### 1.9 Rust Test Infrastructure Setup

#### 1.9.1 Unit Test Organization

```
src-tauri/src/
  editor/
    mod.rs              # pub mod declarations + integration tests
    buffer.rs           # Buffer + BufferManager (with #[cfg(test)] mod tests)
    languages.rs        # LanguageId + LanguageConfig + registry (with tests)
    parsing.rs          # Parse + incremental parse (with tests)
    highlight.rs        # Highlight engine (with tests)
    symbols.rs          # Symbol extraction (with tests)
    search.rs           # Buffer search (with tests)
    error.rs            # EditorError type
  commands/
    editor.rs           # IPC command handlers (with tests)
```

#### 1.9.2 Benchmark Organization

```
src-tauri/benches/
  editor_benchmarks.rs  # Criterion benchmarks (single file, multiple benchmark groups)
```

Using Criterion for Rust benchmarks:

```rust
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn rope_benchmarks(c: &mut Criterion) {
    let mut group = c.benchmark_group("rope_operations");

    for size in [100, 1_000, 10_000, 100_000] {
        group.bench_with_input(
            BenchmarkId::new("insert_char", size),
            &size,
            |b, &size| { /* ... */ }
        );
    }

    group.finish();
}

criterion_group!(benches, rope_benchmarks, parse_benchmarks, highlight_benchmarks);
criterion_main!(benches);
```

#### 1.9.3 Test Data

**File:** `src-tauri/tests/fixtures/` directory with sample files:

```
src-tauri/tests/fixtures/
  sample.js         # ~200 lines of representative JS
  sample.ts         # ~200 lines of representative TS
  sample.rs         # ~200 lines of representative Rust
  sample.py         # ~200 lines of representative Python
  sample.json       # ~100 lines of JSON
  sample.html       # ~100 lines of HTML
  sample.css        # ~100 lines of CSS
  sample.md         # ~100 lines of Markdown
  sample.yaml       # ~50 lines of YAML
  sample.toml       # ~50 lines of TOML
  sample.go         # ~100 lines of Go
  sample.c          # ~100 lines of C
  sample.cpp        # ~100 lines of C++
  sample.sh         # ~50 lines of Bash
  large_10k.js      # ~10000 lines of JS (generated)
  large_50k.js      # ~50000 lines of JS (generated)
```

### 1.10 Phase 1 Test Summary

| Category                     | Test Count (approx.) | Runner         |
| ---------------------------- | -------------------- | -------------- |
| Rust unit: buffer            | 8                    | `cargo test`   |
| Rust unit: languages         | 11                   | `cargo test`   |
| Rust unit: parsing           | 21                   | `cargo test`   |
| Rust unit: highlighting      | 20                   | `cargo test`   |
| Rust unit: symbols           | 10                   | `cargo test`   |
| Rust unit: search            | 8                    | `cargo test`   |
| Rust unit: IPC commands      | 6                    | `cargo test`   |
| Rust benchmarks              | 15                   | `cargo bench`  |
| Frontend unit: editor-engine | 6                    | `vitest`       |
| Frontend perf: editor-engine | 2                    | Playwright E2E |
| **Total**                    | **~107**             |                |

### 1.11 Phase 1 Acceptance Criteria

- [ ] All 13 language parsers initialize and parse without errors
- [ ] Highlight output is correct for all 13 languages (validated against known-good snapshots)
- [ ] `open_buffer` for a 1MB file completes in < 50ms
- [ ] `get_highlights` for 50 lines completes in < 3ms
- [ ] `get_symbols` for a 5000-line file completes in < 10ms
- [ ] All Rust unit tests pass (`cargo test`)
- [ ] All Rust benchmarks complete with acceptable results (`cargo bench`)
- [ ] All existing frontend tests still pass (no regressions)
- [ ] Shadow mode integration works: Rust buffers open/close in sync with Monaco
- [ ] `yarn test:run` passes with no new failures
- [ ] `cargo clippy` passes with no warnings

---

## Phase 2: Rust-Owned Editing

**Duration estimate:** 6-10 weeks
**Goal:** Move all document editing operations to Rust. The frontend sends editing commands (insert, delete, undo, redo) via IPC. Monaco is demoted to a "dumb renderer" that receives content updates from Rust rather than owning the document model.

### 2.1 Edit Operations

#### 2.1.1 Data Model

**File:** `src-tauri/src/editor/editing.rs`

```rust
#[derive(Deserialize)]
pub struct EditOperation {
    pub range: TextRange,         // Where to apply the edit
    pub new_text: String,         // Replacement text (empty = delete)
}

#[derive(Deserialize, Serialize, Clone)]
pub struct TextRange {
    pub start_line: u32,
    pub start_col: u32,
    pub end_line: u32,
    pub end_col: u32,
}

#[derive(Serialize)]
pub struct EditResult {
    pub version: u64,             // New buffer version after edit
    pub applied_range: TextRange, // The range that was actually modified
    pub new_end: Position,        // Cursor position after edit
    pub highlights: ViewportHighlights, // Updated highlights for the visible viewport
}

#[derive(Deserialize, Serialize, Clone)]
pub struct Position {
    pub line: u32,
    pub col: u32,
}
```

#### 2.1.2 Tests First: Edit Operations

| Test                                   | Description                                           |
| -------------------------------------- | ----------------------------------------------------- |
| `test_insert_single_char`              | Insert `a` at position (0,0), verify content          |
| `test_insert_at_end_of_line`           | Insert at EOL, verify content                         |
| `test_insert_at_end_of_file`           | Insert at EOF, verify content                         |
| `test_insert_newline`                  | Insert `\n`, verify line count increases              |
| `test_insert_multiline`                | Insert 3 lines of text, verify rope                   |
| `test_insert_unicode`                  | Insert CJK characters, emoji, verify byte/char counts |
| `test_delete_single_char`              | Delete one char, verify content                       |
| `test_delete_range`                    | Delete range spanning multiple chars, verify          |
| `test_delete_line`                     | Delete entire line, verify line count decreases       |
| `test_delete_multiline`                | Delete range spanning 3 lines, verify                 |
| `test_delete_empty_range`              | Delete with start==end is a no-op                     |
| `test_replace_range`                   | Replace "hello" with "world", verify                  |
| `test_replace_multiline`               | Replace multi-line range with single line             |
| `test_replace_with_multiline`          | Replace single line with multi-line                   |
| `test_edit_updates_version`            | Version increments after each edit                    |
| `test_edit_sets_dirty`                 | Buffer marked dirty after edit                        |
| `test_edit_triggers_incremental_parse` | Tree-sitter tree is updated after edit                |
| `test_edit_returns_highlights`         | EditResult contains updated highlights                |
| `test_multiple_edits_sequential`       | Apply 100 sequential edits, verify final content      |
| `test_edit_at_invalid_position`        | Position beyond EOF returns error                     |
| `test_batch_edit`                      | Apply multiple edits atomically (for multi-cursor)    |

#### 2.1.3 Performance Tests: Editing

| Test                                   | Target    | Description                                                        |
| -------------------------------------- | --------- | ------------------------------------------------------------------ |
| `bench_insert_char`                    | < 1ms     | Insert single character in 10000-line file                         |
| `bench_delete_char`                    | < 1ms     | Delete single character in 10000-line file                         |
| `bench_insert_line`                    | < 1ms     | Insert entire line in 10000-line file                              |
| `bench_edit_plus_parse`                | < 2ms     | Insert char + incremental re-parse                                 |
| `bench_edit_plus_parse_plus_highlight` | < 5ms     | Insert char + re-parse + highlight 50 lines                        |
| `bench_batch_edit_10`                  | < 3ms     | 10 simultaneous edits (multi-cursor simulation)                    |
| `bench_rapid_typing_simulation`        | < 2ms avg | 1000 sequential single-char inserts, measure average per-edit time |

### 2.2 Undo/Redo System

#### 2.2.1 Data Model

**File:** `src-tauri/src/editor/history.rs`

```rust
pub struct EditHistory {
    undo_stack: Vec<UndoGroup>,
    redo_stack: Vec<UndoGroup>,
    current_group: Option<UndoGroup>,
    last_edit_time: Instant,
    coalesce_timeout: Duration,  // Default: 300ms -- edits within this window are grouped
}

pub struct UndoGroup {
    pub edits: Vec<ReversibleEdit>,  // Edits in this group (applied/reversed together)
    pub cursor_before: Position,
    pub cursor_after: Position,
    pub selections_before: Vec<Selection>,
    pub selections_after: Vec<Selection>,
}

pub struct ReversibleEdit {
    pub range: TextRange,
    pub old_text: String,          // Text that was replaced (for undo)
    pub new_text: String,          // Text that was inserted (for redo)
}
```

#### 2.2.2 Tests First: Undo/Redo

| Test                                   | Description                                              |
| -------------------------------------- | -------------------------------------------------------- |
| `test_undo_single_edit`                | Type "hello", undo restores empty                        |
| `test_redo_single_edit`                | Type "hello", undo, redo restores "hello"                |
| `test_undo_multiple_edits`             | Three edits, three undos restores original               |
| `test_redo_cleared_on_new_edit`        | Edit, undo, new edit clears redo stack                   |
| `test_undo_coalescing`                 | Rapid character inserts grouped into one undo group      |
| `test_undo_coalescing_timeout`         | Pause > 300ms starts a new undo group                    |
| `test_undo_newline_breaks_group`       | Enter key always starts a new undo group                 |
| `test_undo_delete_breaks_group`        | Switching from insert to delete starts new group         |
| `test_undo_preserves_cursor`           | Undo restores cursor to pre-edit position                |
| `test_undo_multi_cursor`               | Multi-cursor edit undone atomically                      |
| `test_undo_empty_stack`                | Undo with nothing to undo is a no-op                     |
| `test_redo_empty_stack`                | Redo with nothing to redo is a no-op                     |
| `test_undo_returns_updated_highlights` | Undo returns fresh highlight data                        |
| `test_undo_large_edit`                 | Undo a paste of 10000 lines                              |
| `test_history_memory_bounded`          | History doesn't grow unbounded (configurable max groups) |

#### 2.2.3 Performance Tests: Undo/Redo

| Test                          | Target        | Description                      |
| ----------------------------- | ------------- | -------------------------------- |
| `bench_undo`                  | < 1ms         | Single undo in 10000-line file   |
| `bench_redo`                  | < 1ms         | Single redo in 10000-line file   |
| `bench_undo_large_paste`      | < 5ms         | Undo a 10000-line paste          |
| `bench_1000_undo_redo_cycles` | < 500ms total | 1000 undo + 1000 redo operations |

### 2.3 Selection Model

#### 2.3.1 Data Model

**File:** `src-tauri/src/editor/selection.rs`

```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct Selection {
    pub anchor: Position,     // Where selection started
    pub head: Position,       // Where cursor is (may be before or after anchor)
    pub is_primary: bool,     // Primary cursor (for status bar display)
}

#[derive(Serialize)]
pub struct SelectionState {
    pub selections: Vec<Selection>,  // Multiple cursors
    pub primary_index: usize,        // Index of the primary selection
}
```

#### 2.3.2 Tests First: Selection

| Test                              | Description                                       |
| --------------------------------- | ------------------------------------------------- |
| `test_single_cursor`              | One selection with anchor == head                 |
| `test_selection_forward`          | Select "hello" left-to-right                      |
| `test_selection_backward`         | Select "hello" right-to-left (anchor after head)  |
| `test_selection_multiline`        | Selection spanning 3 lines                        |
| `test_multi_cursor_basic`         | Two cursors at different positions                |
| `test_multi_cursor_type`          | Type char with two cursors, both positions update |
| `test_multi_cursor_overlap_merge` | Overlapping selections merge into one             |
| `test_select_word`                | Double-click word selection boundaries            |
| `test_select_line`                | Triple-click line selection                       |
| `test_select_all`                 | Select all returns (0,0) to (last_line, last_col) |
| `test_cursor_movement_left_right` | Arrow keys move cursor correctly                  |
| `test_cursor_movement_up_down`    | Vertical movement preserves preferred column      |
| `test_cursor_word_boundary`       | Ctrl+Left/Right jumps to word boundaries          |
| `test_cursor_line_start_end`      | Home/End move to line start/end                   |
| `test_cursor_file_start_end`      | Ctrl+Home/End move to file start/end              |
| `test_cursor_clamp_on_edit`       | Cursor beyond EOF after delete is clamped         |

### 2.4 Search Engine

#### 2.4.1 Enhanced Search

**File:** `src-tauri/src/editor/search.rs`

Extends the Phase 1 `search_buffer` with replace capabilities and more search options.

#### 2.4.2 Tests First: Search

| Test                             | Description                               |
| -------------------------------- | ----------------------------------------- |
| `test_search_literal`            | Find "hello" in buffer, correct positions |
| `test_search_case_insensitive`   | Find "Hello" matches "hello"              |
| `test_search_case_sensitive`     | Find "Hello" does not match "hello"       |
| `test_search_regex`              | Find `/\d+/` matches numbers              |
| `test_search_regex_multiline`    | Regex with `\n` matches across lines      |
| `test_search_whole_word`         | "the" doesn't match "there"               |
| `test_search_no_results`         | Non-matching query returns empty          |
| `test_search_in_selection`       | Search only within a selection range      |
| `test_replace_single`            | Replace first occurrence                  |
| `test_replace_all`               | Replace all occurrences, return count     |
| `test_replace_with_regex_groups` | Replace with capture group `$1`           |
| `test_replace_preserves_undo`    | Replace is undoable as single undo group  |
| `test_search_performance_10mb`   | Search 10MB file in < 100ms               |

### 2.5 Code Folding

#### 2.5.1 Data Model

```rust
#[derive(Serialize)]
pub struct FoldRange {
    pub start_line: u32,
    pub end_line: u32,
    pub kind: FoldKind,    // Comment, Import, Region, Block
}
```

#### 2.5.2 Tests First: Code Folding

| Test                             | Description                          |
| -------------------------------- | ------------------------------------ |
| `test_fold_ranges_function`      | Function body produces fold range    |
| `test_fold_ranges_class`         | Class body produces fold range       |
| `test_fold_ranges_if_else`       | If/else blocks produce fold ranges   |
| `test_fold_ranges_comment_block` | Multi-line comment is foldable       |
| `test_fold_ranges_import_group`  | Consecutive imports are foldable     |
| `test_fold_ranges_nested`        | Nested folds (function inside class) |
| `test_fold_ranges_json_objects`  | JSON objects/arrays are foldable     |
| `test_fold_ranges_html_tags`     | HTML elements are foldable           |

### 2.6 New IPC Commands (Phase 2)

| Command                 | Signature                                                                   | Description                               |
| ----------------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| `edit_buffer`           | `(buffer_id, edits: Vec<EditOperation>, viewport: LineRange) -> EditResult` | Apply edits, return updated highlights    |
| `undo_buffer`           | `(buffer_id, viewport: LineRange) -> EditResult`                            | Undo last edit group                      |
| `redo_buffer`           | `(buffer_id, viewport: LineRange) -> EditResult`                            | Redo last undone group                    |
| `get_selections`        | `(buffer_id) -> SelectionState`                                             | Get current selection state               |
| `set_selections`        | `(buffer_id, selections: Vec<Selection>) -> ()`                             | Set selections (from frontend click/drag) |
| `move_cursors`          | `(buffer_id, direction: String, extend_selection: bool) -> SelectionState`  | Move all cursors in a direction           |
| `search_buffer_replace` | `(buffer_id, query, replacement, options) -> ReplaceResult`                 | Find and replace                          |
| `get_fold_ranges`       | `(buffer_id) -> Vec<FoldRange>`                                             | Get all foldable regions                  |
| `save_buffer`           | `(buffer_id) -> ()`                                                         | Write rope content to file path           |
| `get_buffer_content`    | `(buffer_id, start_line, end_line) -> String`                               | Get raw text for a line range             |

### 2.7 Frontend Changes (Phase 2)

#### 2.7.1 Monaco as Dumb Renderer

Modify `CodeEditor.ripple` to:

1. **Disable Monaco's internal editing** -- set `readOnly: true` on the Monaco editor
2. **Capture input** -- intercept all keyboard events before Monaco processes them
3. **Send edits to Rust** -- convert keystrokes into `edit_buffer` IPC calls
4. **Apply Rust responses** -- update Monaco's content via `editor.getModel().applyEdits()` from Rust's EditResult
5. **Apply highlights** -- (optional in Phase 2) override Monaco's tokenizer with Rust-provided highlight data

This is the most architecturally complex step because we need to:

- Handle optimistic updates (show character immediately, reconcile with Rust response)
- Handle IME composition (buffer composed text, send final result to Rust)
- Handle multi-cursor (map all cursor positions to Rust selections)
- Handle paste (large text insertion via single IPC call)

#### 2.7.2 Optimistic Update Architecture

```
Keystroke Event
    |
    +-> [Optimistic] Apply character to local display buffer immediately
    |   (using a small in-memory text patch + CSS class for "pending" highlight)
    |
    +-> [Async] invoke('edit_buffer', { edits, viewport })
            |
            +-> [On Response] Reconcile:
                  - If response matches optimistic update: apply highlights, done
                  - If response differs: replace display content with Rust state
                  - Update cursor position from Rust response
                  - Update version tracking
```

#### 2.7.3 Frontend Tests (Phase 2)

**File:** `tests/lib/editor-engine-editing.test.ts`

| Test                                         | Description                                                 |
| -------------------------------------------- | ----------------------------------------------------------- |
| `test_optimistic_insert_applied_immediately` | Character appears in < 1 frame after keydown                |
| `test_optimistic_reconciliation_on_match`    | Rust response matches optimistic update -- no visual glitch |
| `test_optimistic_reconciliation_on_mismatch` | Rust response differs -- content corrected                  |
| `test_undo_via_ipc`                          | Ctrl+Z sends undo command, content reverts                  |
| `test_redo_via_ipc`                          | Ctrl+Y sends redo command, content restores                 |
| `test_paste_sends_single_edit`               | Clipboard paste sends one edit with full text               |
| `test_version_tracking`                      | Version number increments correctly through edits           |

**File:** `tests/components/code-editor-engine.test.ts`

| Test                                   | Description                            |
| -------------------------------------- | -------------------------------------- |
| `test_editor_sends_edit_on_keypress`   | Typing triggers `edit_buffer` IPC call |
| `test_editor_applies_rust_highlights`  | Highlight data from Rust is rendered   |
| `test_editor_updates_cursor_from_rust` | Cursor position matches Rust response  |
| `test_editor_handles_ipc_error`        | IPC failure shows error, doesn't crash |

### 2.8 Phase 2 Test Summary

| Category                           | Test Count (approx.) | Runner        |
| ---------------------------------- | -------------------- | ------------- |
| Rust unit: editing                 | 21                   | `cargo test`  |
| Rust unit: undo/redo               | 15                   | `cargo test`  |
| Rust unit: selection               | 16                   | `cargo test`  |
| Rust unit: search                  | 13                   | `cargo test`  |
| Rust unit: code folding            | 8                    | `cargo test`  |
| Rust benchmarks: editing           | 7                    | `cargo bench` |
| Rust benchmarks: undo/redo         | 4                    | `cargo bench` |
| Frontend unit: editing integration | 7                    | `vitest`      |
| Frontend component: editor engine  | 4                    | `vitest`      |
| **Total**                          | **~95**              |               |
| **Cumulative (Phase 1+2)**         | **~202**             |               |

### 2.9 Phase 2 Acceptance Criteria

- [ ] All editing operations (insert, delete, replace) work correctly
- [ ] Undo/redo works with coalescing and multi-cursor support
- [ ] Multi-cursor editing works (add cursor, type, all positions update)
- [ ] Search and replace works with regex support
- [ ] Code folding ranges are correctly computed for all languages
- [ ] `edit_buffer` completes in < 5ms (rope edit + parse + highlight)
- [ ] Undo/redo completes in < 1ms
- [ ] Optimistic updates provide perceived < 8ms keystroke latency
- [ ] No regressions in existing Monaco functionality during transition
- [ ] `cargo test` passes all new + existing tests
- [ ] `cargo bench` shows all benchmarks within targets
- [ ] `yarn test:run` passes with no new failures

---

## Phase 3: Custom Renderer + Monaco Removal

**Duration estimate:** 8-14 weeks
**Goal:** Replace Monaco Editor entirely with a custom DOM-based renderer driven by the Rust engine. Remove all Monaco dependencies. The frontend becomes a thin rendering layer that displays what Rust computes.

### 3.1 Custom Renderer Architecture

#### 3.1.1 Component Structure

```
src/components/editor/
  RustEditor.ripple          # Main editor component (replaces CodeEditor.ripple)
  EditorViewport.ripple      # Virtualized line renderer
  EditorGutter.ripple        # Line numbers + fold markers + git decorations
  EditorMinimap.ripple       # Minimap panel (optional)
  EditorScrollbar.ripple     # Custom scrollbar (vertical + horizontal)
  EditorCursor.ripple        # Cursor rendering (blinking, multi-cursor)
  EditorSelection.ripple     # Selection highlight rendering
  EditorInput.ripple         # Hidden textarea for keyboard/IME input capture
  EditorOverlay.ripple       # Find/replace panel, go-to-line, autocomplete popup
```

#### 3.1.2 Rendering Pipeline

```
Rust Engine                          Frontend Renderer
+---------------+                   +---------------------+
| ViewportReq   | <---- scroll ---- | EditorViewport      |
|  (start,end)  |                   |  - Tracks scroll    |
|               |                   |    position         |
| Computes:     | ---- response --> |  - Renders lines    |
|  - lines[]    |                   |    as <div> rows    |
|  - highlights |                   |  - Applies CSS      |
|  - fold state |                   |    classes from     |
|  - selections |                   |    highlight scopes |
|  - cursors    |                   |  - Positions cursor |
|  - diagnostics|                   |    elements         |
+---------------+                   +---------------------+
```

### 3.2 Input System

#### 3.2.1 Hidden Textarea Pattern

**File:** `src/components/editor/EditorInput.ripple`

A hidden `<textarea>` that:

- Is always focused when the editor has focus
- Captures all keyboard input, including IME composition
- Has opacity 0 and is positioned at the cursor location (for IME popup positioning)
- Dispatches input to the Rust engine via IPC

```
Keystroke Flow:
  keydown event on <textarea>
    |
    +- Is it a composition event? (IME)
    |   Yes: Buffer in textarea, wait for compositionend
    |   No:  Extract key + modifiers
    |
    +- Is it a shortcut? (Ctrl+C, Ctrl+V, etc.)
    |   Yes: Handle locally (copy to clipboard, paste from clipboard)
    |
    +- Is it a character input?
        Yes: Send edit_buffer({ insert: char, position: cursor })
             Apply optimistic update to viewport
```

#### 3.2.2 Tests First: Input System

| Test                            | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `test_input_ascii_character`    | Type 'a', edit_buffer called with correct position |
| `test_input_unicode_character`  | Type CJK character, correct char sent              |
| `test_input_enter`              | Enter key sends newline edit                       |
| `test_input_backspace`          | Backspace sends delete-backwards edit              |
| `test_input_delete`             | Delete key sends delete-forwards edit              |
| `test_input_tab`                | Tab sends indent operation                         |
| `test_input_shift_tab`          | Shift+Tab sends outdent operation                  |
| `test_input_composition_start`  | compositionstart disables optimistic updates       |
| `test_input_composition_update` | compositionupdate shows inline composition text    |
| `test_input_composition_end`    | compositionend sends final composed text to Rust   |
| `test_input_paste`              | Ctrl+V reads clipboard, sends single edit          |
| `test_input_cut`                | Ctrl+X copies selection to clipboard, sends delete |
| `test_input_copy`               | Ctrl+C copies selection to clipboard, no edit      |
| `test_input_select_all`         | Ctrl+A sends set_selections with full range        |
| `test_input_undo_shortcut`      | Ctrl+Z sends undo_buffer                           |
| `test_input_redo_shortcut`      | Ctrl+Y/Ctrl+Shift+Z sends redo_buffer              |
| `test_input_find_shortcut`      | Ctrl+F opens find overlay                          |
| `test_input_textarea_position`  | Hidden textarea moves to cursor position for IME   |

### 3.3 Virtualized Line Renderer

#### 3.3.1 Design

**File:** `src/components/editor/EditorViewport.ripple`

The viewport renders only the visible lines plus an overscan buffer (e.g., 20 lines above and below the viewport). Each line is a `<div>` containing `<span>` elements for each highlight span.

```html
<!-- Generated DOM structure -->
<div class="editor-viewport" style="height: {totalLines * lineHeight}px">
  <div class="editor-lines" style="transform: translateY({scrollTop}px)">
    <!-- Only visible lines rendered -->
    <div class="editor-line" data-line="50">
      <span class="hl-keyword">{"const"}</span>
      <span class="hl-default">{" "}</span>
      <span class="hl-variable">{"x"}</span>
      <span class="hl-default">{" = "}</span>
      <span class="hl-number">{"42"}</span>
      <span class="hl-default">{";"}</span>
    </div>
    <!-- ... more lines ... -->
  </div>
</div>
```

#### 3.3.2 CSS Scope Classes

Map tree-sitter highlight scopes to CSS classes:

```css
/* In global.css or editor theme */
.hl-keyword {
  color: var(--syntax-keyword);
}
.hl-string {
  color: var(--syntax-string);
}
.hl-number {
  color: var(--syntax-number);
}
.hl-comment {
  color: var(--syntax-comment);
  font-style: italic;
}
.hl-function {
  color: var(--syntax-function);
}
.hl-type {
  color: var(--syntax-type);
}
.hl-variable {
  color: var(--syntax-variable);
}
.hl-constant {
  color: var(--syntax-constant);
}
.hl-operator {
  color: var(--syntax-operator);
}
.hl-property {
  color: var(--syntax-property);
}
.hl-attribute {
  color: var(--syntax-attribute);
}
.hl-tag {
  color: var(--syntax-tag);
}
.hl-punctuation {
  color: var(--syntax-punctuation);
}
.hl-default {
  color: var(--text-primary);
}
```

#### 3.3.3 Tests First: Viewport Renderer

| Test                                   | Description                                                |
| -------------------------------------- | ---------------------------------------------------------- |
| `test_viewport_renders_visible_lines`  | Only lines in viewport range are in DOM                    |
| `test_viewport_overscan`               | 20 lines above/below viewport are pre-rendered             |
| `test_viewport_scroll_updates_range`   | Scrolling requests new highlights from Rust                |
| `test_viewport_highlight_spans_render` | Each span has correct CSS class                            |
| `test_viewport_line_numbers`           | Line numbers match actual line indices                     |
| `test_viewport_empty_lines`            | Empty lines render as empty divs with min-height           |
| `test_viewport_long_lines`             | Lines longer than viewport width render without truncation |
| `test_viewport_word_wrap`              | With word wrap enabled, long lines wrap                    |
| `test_viewport_tab_rendering`          | Tab characters render with correct width                   |
| `test_viewport_whitespace_rendering`   | Spaces/tabs visible in "show whitespace" mode              |
| `test_viewport_selection_highlight`    | Selected text has selection background class               |
| `test_viewport_active_line`            | Active line has distinct background                        |
| `test_viewport_cursor_rendering`       | Cursor element positioned at correct line/col              |
| `test_viewport_multi_cursor`           | Multiple cursor elements rendered                          |
| `test_viewport_cursor_blink`           | Cursor blinks on/off at configured interval                |
| `test_viewport_fold_collapsed`         | Folded lines are hidden, fold marker shown                 |
| `test_viewport_search_highlight`       | Search matches have highlight decoration                   |

#### 3.3.4 Performance Tests: Rendering

| Test                                     | Target | Description                                                 |
| ---------------------------------------- | ------ | ----------------------------------------------------------- |
| `test_render_50_lines`                   | < 4ms  | Render 50 lines with highlights to DOM                      |
| `test_render_scroll_jump`                | < 8ms  | Scroll jump 10000 lines + render new viewport               |
| `test_render_incremental_update`         | < 2ms  | Update 1 line after edit (only changed DOM nodes)           |
| `test_render_selection_update`           | < 2ms  | Update selection highlight on cursor move                   |
| `test_render_100_lines_with_decorations` | < 8ms  | Render 100 lines with highlights + selections + diagnostics |

### 3.4 Gutter Component

#### 3.4.1 Design

**File:** `src/components/editor/EditorGutter.ripple`

Renders line numbers, fold markers, breakpoint indicators, and git change decorations.

#### 3.4.2 Tests First: Gutter

| Test                                | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `test_gutter_line_numbers`          | Correct line numbers displayed                 |
| `test_gutter_active_line_highlight` | Active line number has accent styling          |
| `test_gutter_fold_markers`          | Fold markers appear at foldable lines          |
| `test_gutter_fold_click`            | Clicking fold marker toggles fold state        |
| `test_gutter_git_decorations`       | Modified/added lines show color indicators     |
| `test_gutter_width_adapts`          | Gutter width adapts to line number digit count |

### 3.5 Minimap Component

#### 3.5.1 Design

**File:** `src/components/editor/EditorMinimap.ripple`

A condensed overview rendered using a `<canvas>` element (minimap is the one place where canvas is appropriate, since it renders text as colored blocks, not readable glyphs).

#### 3.5.2 New IPC Command

| Command            | Signature                                | Description                                     |
| ------------------ | ---------------------------------------- | ----------------------------------------------- |
| `get_minimap_data` | `(buffer_id, scale: f32) -> MinimapData` | Get color blocks for full file at minimap scale |

```rust
#[derive(Serialize)]
pub struct MinimapData {
    pub total_lines: u32,
    pub line_colors: Vec<Vec<MinimapBlock>>,  // Per-line color blocks
}

#[derive(Serialize)]
pub struct MinimapBlock {
    pub start_col: u16,
    pub end_col: u16,
    pub color_index: u8,  // Index into a small palette (keyword=0, string=1, comment=2, etc.)
}
```

#### 3.5.3 Tests First: Minimap

| Test                                  | Description                                            |
| ------------------------------------- | ------------------------------------------------------ |
| `test_minimap_renders_canvas`         | Canvas element appears in DOM                          |
| `test_minimap_viewport_indicator`     | Viewport rectangle is visible and correctly positioned |
| `test_minimap_click_scrolls`          | Clicking minimap scrolls editor to that position       |
| `test_minimap_drag_scrolls`           | Dragging viewport indicator scrolls editor             |
| `test_minimap_colors_match_syntax`    | Color blocks correspond to syntax types                |
| `test_minimap_hidden_when_file_small` | Minimap hidden for files < 50 lines                    |

### 3.6 Find/Replace Overlay

#### 3.6.1 Design

**File:** `src/components/editor/EditorOverlay.ripple`

Renders the find/replace panel as a DOM overlay within the editor area.

#### 3.6.2 Tests First: Find/Replace Overlay

| Test                                  | Description                             |
| ------------------------------------- | --------------------------------------- |
| `test_find_opens_on_shortcut`         | Ctrl+F opens find panel                 |
| `test_find_highlights_matches`        | All matches highlighted in viewport     |
| `test_find_navigates_next`            | Enter/F3 moves to next match            |
| `test_find_navigates_prev`            | Shift+F3 moves to previous match        |
| `test_find_match_count`               | "3 of 42" counter displayed             |
| `test_find_case_toggle`               | Case-sensitive toggle works             |
| `test_find_regex_toggle`              | Regex toggle works                      |
| `test_find_whole_word_toggle`         | Whole word toggle works                 |
| `test_replace_single`                 | Replace button replaces current match   |
| `test_replace_all`                    | Replace all button replaces all matches |
| `test_find_closes_on_escape`          | Escape closes find panel                |
| `test_find_replace_opens_on_shortcut` | Ctrl+H opens find+replace panel         |

### 3.7 Monaco Removal

#### 3.7.1 Files to Delete

| File                                      | Reason                                          |
| ----------------------------------------- | ----------------------------------------------- |
| `src/components/editor/CodeEditor.ripple` | Replaced by `RustEditor.ripple`                 |
| `src/lib/monaco-workers.ts`               | No longer needed (no Monaco workers)            |
| `src/lib/monaco-theme.ts`                 | Replaced by CSS scope classes + theme variables |
| `tests/e2e/monaco-editor.spec.ts`         | Replaced by new E2E tests                       |

#### 3.7.2 Dependencies to Remove from package.json

```
monaco-editor
vite-plugin-monaco-editor-esm
```

#### 3.7.3 Vite Config Changes

Remove from `vite.config.ts`:

- `manualChunks` entry for `monaco-editor`
- `optimizeDeps.include` entry for `monaco-editor`

#### 3.7.4 Files to Modify

| File                                      | Change                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/layout/EditorArea.ripple` | Import `RustEditor` instead of `CodeEditor`                                               |
| `src/lib/workspace.ts`                    | Remove any Monaco-specific logic; use `editorEngine` for all document operations          |
| `src/lib/editor-settings.ts`              | Keep settings, adapt for new renderer (e.g., minimap toggle, font size apply via CSS var) |
| `src/lib/tauri.ts`                        | Add new editor engine IPC wrappers                                                        |
| `tests/setup.ts`                          | Remove Monaco mock, add editor engine IPC mocks                                           |
| `vite.config.ts`                          | Remove Monaco chunk splitting, add editor CSS chunk if needed                             |
| `package.json`                            | Remove `monaco-editor`, `vite-plugin-monaco-editor-esm`                                   |

### 3.8 New IPC Commands (Phase 3)

| Command            | Signature                                                                      | Description                                      |
| ------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| `get_viewport`     | `(buffer_id, start_line, end_line, include_diagnostics: bool) -> ViewportData` | All-in-one viewport data fetch                   |
| `scroll_to_line`   | `(buffer_id, line: u32) -> ViewportData`                                       | Scroll to line, return viewport data             |
| `fold_toggle`      | `(buffer_id, line: u32) -> Vec<FoldRange>`                                     | Toggle fold at line                              |
| `fold_all`         | `(buffer_id) -> Vec<FoldRange>`                                                | Fold all regions                                 |
| `unfold_all`       | `(buffer_id) -> Vec<FoldRange>`                                                | Unfold all regions                               |
| `get_minimap_data` | `(buffer_id, scale: f32) -> MinimapData`                                       | Minimap color blocks                             |
| `format_buffer`    | `(buffer_id) -> EditResult`                                                    | Format document (future: via external formatter) |
| `indent_line`      | `(buffer_id, lines: Vec<u32>, direction: String) -> EditResult`                | Indent/outdent lines                             |
| `comment_toggle`   | `(buffer_id, lines: Vec<u32>) -> EditResult`                                   | Toggle line comments                             |
| `duplicate_lines`  | `(buffer_id, lines: Vec<u32>) -> EditResult`                                   | Duplicate selected lines                         |
| `move_lines`       | `(buffer_id, lines: Vec<u32>, direction: String) -> EditResult`                | Move lines up/down                               |

```rust
#[derive(Serialize)]
pub struct ViewportData {
    pub buffer_id: String,
    pub version: u64,
    pub lines: Vec<HighlightedLine>,
    pub total_lines: u32,
    pub selections: Vec<Selection>,
    pub fold_ranges: Vec<FoldRange>,
    pub diagnostics: Vec<Diagnostic>,  // Future: from LSP
    pub search_matches: Vec<TextRange>, // If search is active
}
```

### 3.9 E2E Tests (Phase 3)

**File:** `tests/e2e/rust-editor.spec.ts`

| Test                                   | Description                                        |
| -------------------------------------- | -------------------------------------------------- |
| `test_editor_renders_on_file_open`     | Open file, editor viewport visible with content    |
| `test_editor_syntax_highlighting`      | Highlighted spans have correct CSS classes         |
| `test_editor_type_character`           | Type 'a', character appears in correct position    |
| `test_editor_type_multiple_characters` | Type "hello", all characters render                |
| `test_editor_backspace`                | Delete character, content updates                  |
| `test_editor_enter_newline`            | Press Enter, new line created                      |
| `test_editor_undo_redo`                | Type, Ctrl+Z undoes, Ctrl+Y redoes                 |
| `test_editor_copy_paste`               | Select text, Ctrl+C, move cursor, Ctrl+V           |
| `test_editor_find`                     | Ctrl+F opens find, type query, matches highlighted |
| `test_editor_find_replace`             | Find and replace single and all                    |
| `test_editor_scroll`                   | Scroll down in large file, new lines render        |
| `test_editor_go_to_line`               | Ctrl+G, enter line number, editor scrolls          |
| `test_editor_multi_cursor`             | Alt+Click adds cursor, type updates both positions |
| `test_editor_code_folding`             | Click fold gutter, lines collapse                  |
| `test_editor_word_wrap`                | Toggle word wrap, long lines wrap                  |
| `test_editor_minimap`                  | Minimap visible, click scrolls                     |
| `test_editor_tab_switching`            | Open two files, switch tabs, correct content shown |
| `test_editor_theme_switch`             | Switch theme, syntax colors update                 |
| `test_editor_zoom`                     | Ctrl+= increases font size                         |
| `test_editor_large_file`               | Open 10MB file, editor remains responsive          |
| `test_editor_no_console_errors`        | No JS console errors during all operations         |

**File:** `tests/e2e/rust-editor-perf.spec.ts`

| Test                      | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `test_keystroke_latency`  | Measure keydown-to-render time, assert < 8ms (p95) |
| `test_scroll_performance` | Measure scroll-to-render time for large jumps      |
| `test_file_open_time`     | Measure time from click to content visible         |

### 3.10 Accessibility Tests (Phase 3)

**File:** `tests/e2e/a11y/rust-editor-a11y.spec.ts`

| Test                                  | Description                                                            |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `test_editor_role`                    | Editor has `role="textbox"` or appropriate ARIA role                   |
| `test_editor_label`                   | Editor has accessible label (file name)                                |
| `test_editor_aria_multiline`          | `aria-multiline="true"`                                                |
| `test_editor_focus_visible`           | Focus indicator visible when editor focused                            |
| `test_editor_keyboard_navigation`     | Tab into/out of editor works                                           |
| `test_editor_screen_reader_line`      | Current line text is announced to screen reader (via aria-live region) |
| `test_editor_screen_reader_selection` | Selection change announced                                             |
| `test_editor_high_contrast`           | Colors pass WCAG AA in high contrast mode                              |

### 3.11 Phase 3 Test Summary

| Category                            | Test Count (approx.) | Runner       |
| ----------------------------------- | -------------------- | ------------ |
| Frontend unit: input system         | 18                   | `vitest`     |
| Frontend unit: viewport renderer    | 17                   | `vitest`     |
| Frontend unit: viewport perf        | 5                    | `vitest`     |
| Frontend unit: gutter               | 6                    | `vitest`     |
| Frontend unit: minimap              | 6                    | `vitest`     |
| Frontend unit: find/replace overlay | 12                   | `vitest`     |
| Rust unit: minimap data             | 4                    | `cargo test` |
| Rust unit: viewport commands        | 6                    | `cargo test` |
| Rust unit: line operations          | 8                    | `cargo test` |
| E2E: rust-editor                    | 21                   | Playwright   |
| E2E: rust-editor-perf               | 3                    | Playwright   |
| E2E: accessibility                  | 8                    | Playwright   |
| **Total**                           | **~114**             |              |
| **Cumulative (Phase 1+2+3)**        | **~316**             |              |

### 3.12 Phase 3 Acceptance Criteria

- [ ] Monaco Editor fully removed (zero `monaco-editor` imports in codebase)
- [ ] Custom renderer displays syntax-highlighted code for all 13 languages
- [ ] All editing operations work: type, delete, undo, redo, copy, paste, cut
- [ ] Multi-cursor editing works
- [ ] Find/replace works with regex, case, whole word options
- [ ] Code folding works
- [ ] Minimap works
- [ ] Gutter with line numbers, fold markers renders correctly
- [ ] Word wrap toggles correctly
- [ ] Theme switching updates all syntax colors
- [ ] Zoom in/out works
- [ ] Keyboard shortcuts work (all actions from `keybindings/actions.ts`)
- [ ] IME input works (CJK characters, dead keys, composition)
- [ ] Large files (10MB+) render and edit without lag
- [ ] Perceived keystroke latency < 8ms (p95)
- [ ] File open time < 50ms for 1MB files
- [ ] Scroll performance: new viewport renders in < 16ms
- [ ] All Rust tests pass (`cargo test`)
- [ ] All Rust benchmarks within targets (`cargo bench`)
- [ ] All frontend tests pass (`yarn test:run`)
- [ ] All E2E tests pass (`yarn test:e2e`)
- [ ] Accessibility tests pass
- [ ] Bundle size reduced compared to Monaco build
- [ ] No regressions in non-editor functionality (chat, terminal, file tree, settings)

---

## Risk Register

| Risk                                            | Severity | Likelihood | Mitigation                                                                                                                                                                                 |
| ----------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **IME input bugs**                              | Critical | High       | Extensive testing with CJK input methods. Keep hidden textarea pattern well-tested. Reference Monaco's IME handling code.                                                                  |
| **IPC latency spikes**                          | High     | Medium     | Optimistic updates absorb latency. Monitor p99 latency. Consider Tauri channels (streaming) instead of invoke for high-frequency operations.                                               |
| **Tree-sitter grammar version incompatibility** | Medium   | Medium     | Pin all grammar crates to known-compatible versions. Add CI test that validates all parsers initialize.                                                                                    |
| **Large file memory pressure**                  | Medium   | Low        | Ropey is memory-efficient. Tree-sitter trees are compact. Monitor with benchmarks.                                                                                                         |
| **Platform-specific rendering differences**     | Medium   | Medium     | Test on macOS, Windows, Linux. Font rendering differs per platform -- use system font stack.                                                                                               |
| **Missing Monaco features**                     | Medium   | High       | Not all Monaco features will be replicated. Prioritize: editing > highlighting > folding > minimap > autocomplete. Some features (IntelliSense, hover) may require future LSP integration. |
| **Development timeline overrun**                | High     | High       | Phase 1 is low-risk (parallel mode). Phase 2 is medium-risk. Phase 3 is highest risk. Each phase is independently valuable -- can stop after any phase.                                    |
| **Regression in existing features**             | High     | Medium     | Full test suite must pass at every phase. Shadow mode in Phase 1 catches issues early.                                                                                                     |
| **Accessibility regression**                    | High     | Medium     | Dedicated accessibility tests in Phase 3. Keep DOM-based rendering (not canvas) specifically for accessibility.                                                                            |

---

## Appendix: Crate Versions

> These versions are indicative as of February 2026. Verify latest compatible versions at implementation time.

| Crate                    | Version             | Notes                                |
| ------------------------ | ------------------- | ------------------------------------ |
| `ropey`                  | 1.6.x (or 2.0-beta) | Evaluate 2.0-beta stability          |
| `tree-sitter`            | 0.24.x              | Core parser. Must match grammar ABI. |
| `tree-sitter-highlight`  | 0.24.x              | Highlighting engine                  |
| `tree-sitter-tags`       | 0.24.x              | Symbol extraction                    |
| `tree-sitter-javascript` | 0.23.x              | JS grammar                           |
| `tree-sitter-typescript` | 0.23.x              | TS + TSX grammars                    |
| `tree-sitter-json`       | 0.24.x              | JSON grammar                         |
| `tree-sitter-html`       | 0.23.x              | HTML grammar                         |
| `tree-sitter-css`        | 0.23.x              | CSS grammar                          |
| `tree-sitter-rust`       | 0.23.x              | Rust grammar                         |
| `tree-sitter-python`     | 0.23.x              | Python grammar                       |
| `tree-sitter-markdown`   | 0.4.x               | Markdown grammar                     |
| `tree-sitter-yaml`       | 0.7.x               | YAML grammar                         |
| `tree-sitter-toml-ng`    | 0.7.x               | TOML grammar                         |
| `tree-sitter-go`         | 0.23.x              | Go grammar                           |
| `tree-sitter-c`          | 0.23.x              | C grammar                            |
| `tree-sitter-cpp`        | 0.23.x              | C++ grammar                          |
| `tree-sitter-bash`       | 0.23.x              | Bash grammar                         |
| `criterion`              | 0.5.x               | Benchmarking framework               |

### Version Compatibility Note

Tree-sitter grammar crates must use a compatible ABI with the `tree-sitter` core crate. When updating, always update the core crate first, then update grammars to versions that target the same ABI version. The `tree-sitter` crate exposes `LANGUAGE_VERSION` and `MIN_COMPATIBLE_LANGUAGE_VERSION` constants -- use these to validate compatibility at compile time or in tests.
