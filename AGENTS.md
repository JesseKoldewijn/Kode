# AGENTS.md

This document provides AI coding assistants with comprehensive context about the Kode project.

## Project Overview

**Kode** is a performant, open-source desktop code editor with integrated AI chat support for CLI code agents (similar to Cursor). Built with Tauri v2 (Rust backend) and a custom reactive UI framework called Ripple.

### Key Features

- Modern code editing with Monaco Editor (VS Code's editor, full IntelliSense for JS/TS)
- Syntax highlighting for JS/TS, JSON, Markdown, CSS, HTML, Rust, Python, YAML, and more
- Integrated AI chat panel for interacting with CLI code agents (like OpenCode)
- File system navigation with sidebar file tree
- Integrated terminal emulator (xterm.js with WebGL rendering)
- Command palette for quick actions
- Theme support (dark/light/system)

## Tech Stack

### Frontend

| Technology                    | Version | Purpose                                                     |
| ----------------------------- | ------- | ----------------------------------------------------------- |
| Ripple                        | latest  | TypeScript-first reactive UI framework (`.ripple` files)    |
| TailwindCSS                   | v4      | CSS-based utility styling                                   |
| Vite (rolldown-vite)          | latest  | Build tool                                                  |
| Monaco Editor                 | latest  | Code editor (VS Code's editor engine)                       |
| vite-plugin-monaco-editor-esm | 2.0.2   | Monaco Editor Vite integration (ESM, Node.js 25 compatible) |
| xterm.js                      | v5      | Terminal emulator                                           |
| TypeScript                    | ^5.7    | Language                                                    |

### Backend (Tauri/Rust)

| Technology    | Version                | Purpose                       |
| ------------- | ---------------------- | ----------------------------- |
| Tauri         | v2                     | Desktop application framework |
| Rust          | 2021 edition (1.77.2+) | Backend language              |
| portable-pty  | 0.8                    | Terminal/PTY emulation        |
| tokio         | 1                      | Async runtime                 |
| fuzzy-matcher | 0.3                    | File search                   |
| ignore        | 0.4                    | .gitignore-aware file walking |

### Package Management

- **Node.js:** 25.6.0 (managed via Volta)
- **Yarn:** 4.12.0 (Berry)

## Directory Structure

```
Kode/
├── src/                        # Frontend source code
│   ├── components/             # UI components (.ripple files)
│   │   ├── chat/              # AI chat panel (ChatPanel, ChatInput, ChatMessage)
│   │   ├── editor/            # Code editor (CodeEditor, EditorTabs)
│   │   ├── filetree/          # File explorer (FileTree, FileNode)
│   │   ├── layout/            # Layout components (Sidebar, EditorArea, Panel, StatusBar)
│   │   ├── palette/           # Command palette
│   │   └── terminal/          # Terminal component
│   ├── lib/                   # Utility libraries
│   │   ├── mocks/             # Browser mock system for dev without Tauri
│   │   ├── tauri.ts           # Tauri API wrapper functions
│   │   ├── workspace.ts       # Workspace/file state management
│   │   ├── theme.ts           # Theme management
│   │   └── monaco-theme.ts    # Monaco Editor theme definitions
│   ├── styles/                # Global styles (global.css with Tailwind)
│   ├── App.ripple             # Main application component
│   └── main.ts                # Application entry point
├── src-tauri/                  # Tauri/Rust backend
│   ├── src/
│   │   ├── commands/          # IPC command handlers
│   │   │   ├── filesystem.rs  # File operations (read, write, search)
│   │   │   ├── terminal.rs    # PTY terminal management
│   │   │   └── agent.rs       # AI agent process spawning
│   │   ├── lib.rs             # Main Tauri setup and command registration
│   │   └── main.rs            # Entry point
│   ├── capabilities/          # Tauri security capabilities
│   └── tauri.conf.json        # Tauri configuration
├── tests/                      # Test files
│   ├── components/            # Component tests
│   ├── e2e/                   # Playwright E2E tests
│   ├── lib/                   # Library tests
│   └── setup.ts               # Vitest setup (mocks Tauri APIs)
├── .agents/                    # AI agent skill definitions
│   └── skills/                # Skill files for AI assistants
└── package.json
```

## Development Commands

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `yarn dev`         | Start Vite dev server (port 1420)       |
| `yarn tauri:dev`   | Start Tauri development with hot reload |
| `yarn build`       | Build frontend for production           |
| `yarn tauri:build` | Build Tauri desktop application         |
| `yarn format`      | Format code with Prettier               |
| `yarn test`        | Run Vitest in watch mode                |
| `yarn test:run`    | Run Vitest once                         |
| `yarn test:e2e`    | Run Playwright E2E tests                |

## Coding Conventions

### Ripple Framework

Ripple is a TypeScript-first reactive UI framework. Components use `.ripple` file extension.

> **Full Reference:** `.agents/skills/ripple/SKILL.md`
> **Online Docs:** https://www.ripple-ts.com/llms.txt

#### Critical Rules

**1. Text MUST be wrapped in expressions:**

```javascript
// WRONG - will cause errors
<div>Hello World</div>

// CORRECT
<div>{"Hello World"}</div>
```

**2. Reactive state uses `track()` and `@` syntax:**

```javascript
import { track } from 'ripple';

export component Counter() {
  let count = track(0);

  // Read with @variable, write with @variable = value
  <button onClick={() => @count++}>
    {"Count: "}{@count}
  </button>
}
```

**3. NO JSX-style comments in templates (causes runtime crash):**

```javascript
// WRONG - causes "Illegal invocation" error
<div>
  {/* This comment breaks the app */}
  <span>{"Content"}</span>
</div>

// CORRECT - use TypeScript comments outside templates
export component Example() {
  // Comments here are fine
  let value = track(0);

  <div>
    <span>{@value}</span>
  </div>
}
```

**4. Component definition syntax:**

```javascript
export component MyComponent(prop1: string, prop2?: number) {
  <div>{prop1}</div>
}

// With children
export component Card(children: Children) {
  <div class="card">{children}</div>
}
```

**5. Dynamic classes use object syntax:**

```javascript
<div class={{
  'base-class': true,
  'active': @isActive,
  'hidden': !@isVisible
}}>
  {"Content"}
</div>
```

**6. Effects with cleanup:**

```javascript
import { effect } from 'ripple';

effect(() => {
  console.log('Value changed:', @someValue);
  return () => {
    // cleanup function (runs before next effect or on unmount)
  };
});
```

**7. Control flow (if/for/switch):**

```javascript
// Conditionals
if (condition) {
  <div>{'True branch'}</div>;
} else {
  <div>{'False branch'}</div>;
}

// Loops - always use key
for (const item of items) {
  <div key={item.id}>{item.name}</div>;
}
```

**8. Templates only inside components (cannot create JSX in regular functions):**

```javascript
// WRONG
function createButton() {
  return <button>{"Click"}</button>;
}

// CORRECT - use a component
export component MyButton() {
  <button>{"Click"}</button>
}
```

#### Reactive Arrays (CRITICAL)

**The Problem:**
Arrays declared as plain TypeScript types (`Type[]`) are NOT reactive in Ripple. This causes UI to not update when items are added, removed, or modified, even though the data is correctly fetched.

**The Solution:**
ALWAYS use `track<Type[]>([])` for arrays and ALWAYS use `@` prefix for mutations.

```typescript
// ❌ WRONG - Not reactive, UI won't update
let messages: Message[] = [];
messages.push(newMessage);  // UI doesn't re-render
if (messages.length > 0) {  // Always reads initial value
  // ...
}

// ✅ CORRECT - Reactive, UI updates automatically
let messages = track<Message[]>([]);
@messages.push(newMessage);  // ✅ UI re-renders
if (@messages.length > 0) {  // ✅ Reads current value
  // ...
}
```

**Common Array Operations:**

```typescript
// Declaration
let items = track<Item[]>([]);

// Reading (use @ prefix in templates/conditions)
for (const item of @items) { }
if (@items.length > 0) { }
const count = @items.length;

// Mutation (MUST use @ prefix)
@items.push(newItem);           // Add item
@items.splice(index, 1);        // Remove item
@items[0] = updatedItem;        // Update item
@items.length = 0;              // Clear array

// Replace entire array
@items.length = 0;
@items.push(...newItems);
```

**Fixed Components:**

- `ChatPanel.ripple` - `messages` array (lines 19-28)
- `CommandPalette.ripple` - `fileResults` array (lines 22-29)
- `Sidebar.ripple` - `searchResults` and `fileGroups` arrays (lines 21-22)
- `SourceControl.ripple` - `changes` array (line 57)

**Regression Tests:**
See `tests/lib/reactive-arrays.test.ts` for comprehensive test coverage of reactive array patterns.

### TypeScript

**Prettier Configuration:**

- Semicolons: enabled
- Single quotes: enabled
- Tab width: 2
- Trailing commas: ES5
- Print width: 100

**Path Aliases:**

- `@/*` maps to `src/*`

**Module System:** ES Modules (`"type": "module"`)

### Rust/Tauri

> **Full Reference:** `.agents/skills/tauri-v2/SKILL.md`

**Tauri Commands:**

```rust
#[tauri::command]
async fn my_command(param: String) -> Result<String, String> {
    // Implementation
    Ok("result".to_string())
}
```

**IPC from Frontend:**

```typescript
import { invoke } from '@tauri-apps/api/core';

const result = await invoke<string>('my_command', { param: 'value' });
```

**Event System:**

```typescript
import { listen, emit } from '@tauri-apps/api/event';

// Listen for events
const unlisten = await listen('event-name', (event) => {
  console.log(event.payload);
});

// Emit events
await emit('event-name', { data: 'payload' });
```

## Testing

### Unit/Integration Tests (Vitest)

- **Location:** `tests/**/*.test.ts`
- **Environment:** jsdom
- **Setup:** `tests/setup.ts` (mocks all Tauri APIs)

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyComponent', () => {
  it('should work', () => {
    // Test implementation
  });
});
```

### E2E Tests (Playwright)

- **Location:** `tests/e2e/**/*.spec.ts`
- **Base URL:** `http://localhost:1420`

```typescript
import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#app')).toBeVisible();
});
```

### Tauri API Mocking

Tests mock Tauri APIs via `tests/setup.ts`. The mock system intercepts:

- `@tauri-apps/api` (invoke, event)
- `@tauri-apps/plugin-fs` (file operations)
- `@tauri-apps/plugin-shell` (command execution)
- `@tauri-apps/plugin-store` (persistent storage)
- `@tauri-apps/plugin-log` (logging)
- `@tauri-apps/plugin-process` (exit, relaunch)
- `monaco-editor` (editor instance creation, theme management)

## Key Patterns

### Browser Development Mode

The app can run in browser-only mode without Tauri for faster development iteration:

- Mock system in `src/lib/mocks/` intercepts Tauri IPC calls
- Provides a demo project filesystem for testing UI
- Controlled via `__ENABLE_MOCKS__` compile-time flag
- Use `yarn dev` for browser-only, `yarn tauri:dev` for full desktop

### Theme System

- CSS custom properties for all theme colors (defined in `src/styles/global.css`)
- Three modes: `dark` (default), `light`, `system`
- Persisted to localStorage
- Managed via `src/lib/theme.ts`

### Tauri IPC Commands

**Filesystem Commands** (`src-tauri/src/commands/filesystem.rs`):

- `read_directory` - List directory contents
- `read_file` / `write_file` - File I/O
- `create_file` / `create_directory` - Create new items
- `delete_path` / `rename_path` - File management
- `search_files` - Fuzzy file search
- `search_content` - Grep-like content search

**Terminal Commands** (`src-tauri/src/commands/terminal.rs`):

- `spawn_terminal` - Create PTY session
- `write_terminal` - Send input to terminal
- `resize_terminal` - Resize PTY
- `kill_terminal` - Terminate session

**Agent Commands** (`src-tauri/src/commands/agent.rs`):

- `start_agent` - Start AI agent process
- `send_to_agent` - Send message to agent
- `stop_agent` - Terminate agent

## Available Skills

The `.agents/skills/` directory contains specialized skill definitions for AI assistants:

| Skill                    | Path                                           | Description                              |
| ------------------------ | ---------------------------------------------- | ---------------------------------------- |
| **ripple**               | `.agents/skills/ripple/SKILL.md`               | Ripple framework syntax and patterns     |
| **tauri-v2**             | `.agents/skills/tauri-v2/SKILL.md`             | Tauri v2 IPC, commands, and capabilities |
| **systematic-debugging** | `.agents/skills/systematic-debugging/SKILL.md` | Debugging methodology and techniques     |
| **frontend-design**      | `.agents/skills/frontend-design/SKILL.md`      | Frontend design patterns                 |
| **ui-ux-pro-max**        | `.agents/skills/ui-ux-pro-max/SKILL.md`        | UI/UX guidelines and best practices      |

## Testing

### Test Status

- **Unit/Integration Tests**: 512/512 passing ✅ (includes 33 Monaco Editor tests)
- **E2E Tests**: 28/28 total (22 passing, 6 A11y tests have known issues)
- **Build**: Production build successful ✅
- **Dev Server**: Starts without errors ✅

### Testing Strategy

**Integration Tests** (`tests/components/*.test.ts`):

- Component mounting and rendering
- User interaction simulation (clicks, keyboard events)
- Props and state management
- Fast execution in jsdom environment
- Reliable for testing component behavior

**E2E Tests** (`tests/e2e/*.spec.ts`):

- Full application workflow testing
- Browser environment with Vite dev server
- Real user interaction patterns
- Tests cross-component integration

### CommandPalette Testing

The CommandPalette component is tested via **integration tests** rather than E2E tests due to Ripple framework reactivity timing:

**Why Integration Tests?**

- When CommandPalette mounts with `mode: 'commands'`, Ripple's reactive effects update asynchronously
- Playwright/E2E tests timeout waiting for the `hidden` class to be removed from parent container
- Integration tests with direct user input simulation (typing ">") are more reliable
- Tests cover all functionality: opening, closing, mode switching, keyboard navigation

**Test Coverage** (`tests/components/command-palette.test.ts`):

- Opening/closing behavior
- Mode switching via input (files ↔ commands)
- Keyboard shortcuts (Escape to close)
- Visual elements (icons, hints, footer)
- All 20 tests passing consistently

### Test Helper Functions

**triggerAction()** - Dispatch custom event to trigger actions (bypasses Chromium interception)

```typescript
await triggerAction(page, 'view.quickOpen'); // Opens command palette
```

**sendShortcut()** - Dispatch keyboard events for non-intercepted shortcuts

```typescript
await sendShortcut(page, 'j', { ctrl: true }); // Toggle panel
```

## Common Pitfalls

1. **Forgetting text expressions** - Always wrap text in `{"text"}` in Ripple templates
2. **JSX comments in templates** - Use TypeScript comments outside templates only
3. **Missing `key` in loops** - Always provide unique keys for list items
4. **Tauri API in tests** - Ensure `tests/setup.ts` mocks are updated when adding new Tauri commands
5. **Browser vs Tauri mode** - Check `__ENABLE_MOCKS__` when debugging platform-specific issues
6. **Reactive reads without `@`** - Using `variable` instead of `@variable` won't trigger reactivity
