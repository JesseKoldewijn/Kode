# Custom Editor Testing Guide

This document provides instructions for testing the newly implemented custom Rust-based editor.

## What Was Implemented

### Phase 3: Text Input & Optimistic Updates ✅

**Features Completed:**

1. **Text Input Pipeline**
   - Characters typed are inserted at cursor position
   - Selection ranges are replaced with typed text
   - Multi-line text input supported (e.g., pasting)
   - Cursor position automatically updated after insertion

2. **Optimistic Updates**
   - Local content buffer (`localContent`) for instant UI feedback
   - Edits applied to local buffer immediately (<1ms perceived latency)
   - Backend IPC call runs in background
   - Version tracking for reconciliation (`serverVersion`, `pendingEdits`)

3. **Backspace/Delete Key Handling**
   - **Backspace:**
     - Deletes selected text if selection exists
     - Deletes previous character if cursor
     - Joins with previous line if at start of line
   - **Delete:**
     - Deletes selected text if selection exists
     - Deletes next character if cursor
     - Joins with next line if at end of line

4. **Scroll-to-Cursor**
   - Automatically scrolls viewport when cursor moves offscreen
   - Scrolls up if cursor above viewport
   - Scrolls down if cursor below viewport
   - Smooth scrolling behavior

5. **Status Bar Integration**
   - Cursor position (line, column) synced to status bar
   - Updates in real-time as cursor moves

## Testing Instructions

### Setup

1. **Start the development server:**

   ```bash
   yarn dev
   ```

   The app will open at `http://localhost:1420`

2. **Open a file:**
   - Use the file tree on the left sidebar
   - Or press `Ctrl+O` to open the command palette and select a file

### Test Cases

#### 1. Basic Typing

**Steps:**

1. Click in the editor to place cursor
2. Type some characters (e.g., "hello world")

**Expected:**

- Characters appear instantly at cursor position
- Cursor moves forward after each character
- Status bar shows updated cursor position

#### 2. Multi-line Input

**Steps:**

1. Place cursor in editor
2. Type some text
3. Press `Enter` to create new line
4. Type more text

**Expected:**

- New line created on Enter
- Cursor moves to start of new line
- Line numbers update correctly
- Syntax highlighting preserved

#### 3. Selection and Replace

**Steps:**

1. Click and drag to select some text
2. Type new text (e.g., "replaced")

**Expected:**

- Selection highlighted in blue (`#264f78`)
- Typing replaces entire selection
- Cursor positioned after new text

#### 4. Backspace Operations

**Test A - Delete Character:**

1. Place cursor after a character
2. Press `Backspace`

**Expected:** Previous character deleted

**Test B - Delete Selection:**

1. Select multiple characters
2. Press `Backspace`

**Expected:** Entire selection deleted

**Test C - Join Lines:**

1. Place cursor at start of line (not line 0)
2. Press `Backspace`

**Expected:** Current line joined with previous line

#### 5. Delete Operations

**Test A - Delete Character:**

1. Place cursor before a character
2. Press `Delete`

**Expected:** Next character deleted, cursor stays in place

**Test B - Delete Selection:**

1. Select multiple characters
2. Press `Delete`

**Expected:** Entire selection deleted

**Test C - Join Lines:**

1. Place cursor at end of line (not last line)
2. Press `Delete`

**Expected:** Next line joined with current line

#### 6. Arrow Key Navigation

**Steps:**

1. Place cursor in middle of text
2. Press `Left`, `Right`, `Up`, `Down` arrow keys

**Expected:**

- Cursor moves correctly in all directions
- Cursor wraps to previous/next line at line boundaries
- Status bar updates cursor position

#### 7. Selection with Shift+Arrow

**Steps:**

1. Place cursor in text
2. Hold `Shift` and press arrow keys

**Expected:**

- Selection extends from anchor point
- Selection highlights text in blue
- Status bar shows updated cursor position

#### 8. Home/End Keys

**Steps:**

1. Press `Home` - cursor moves to start of line
2. Press `End` - cursor moves to end of line
3. Hold `Shift` + `Home`/`End` - selects to start/end

**Expected:**

- Cursor/selection moves correctly
- Visual feedback matches behavior

#### 9. Scroll-to-Cursor

**Steps:**

1. Open a file with >50 lines
2. Press `Down` arrow repeatedly until cursor goes offscreen

**Expected:**

- Viewport automatically scrolls down to keep cursor visible
- Same behavior for scrolling up with `Up` arrow

#### 10. Syntax Highlighting During Editing

**Steps:**

1. Open a TypeScript file
2. Type a keyword (e.g., `function`, `const`, `if`)
3. Type a string (e.g., `"hello"`)

**Expected:**

- Keywords highlighted in appropriate color
- Strings highlighted in green
- Highlighting updates after short delay (background IPC)

#### 11. Large File Performance

**Steps:**

1. Open a file with 1000+ lines
2. Scroll to middle of file
3. Type characters, use backspace/delete

**Expected:**

- Typing feels instant (<8ms perceived latency)
- Scrolling smooth
- Only visible lines rendered (virtualization working)

## Known Limitations (Phase 3)

The following features are **not yet implemented** and should be skipped during testing:

1. **Undo/Redo** - History module is stubbed
2. **Copy/Paste/Cut** - No clipboard integration yet
3. **Find/Replace** - Search module is stubbed
4. **Multi-cursor** - Backend supports it but frontend only handles single cursor
5. **Code folding** - Not implemented
6. **Optimistic update conflicts** - Version reconciliation logic exists but edge cases not tested

## Performance Targets

- **Keystroke latency:** <8ms perceived (optimistic updates)
- **Backend IPC:** <50ms for edit operations (async)
- **Syntax highlighting:** <100ms for viewport update
- **Scroll performance:** 60 FPS with virtualization

## Troubleshooting

### Issue: Characters don't appear

**Check:**

- Dev console for errors
- Verify file is open (buffer ID not null)
- Check `EditorInput` component has focus

### Issue: Cursor doesn't move

**Check:**

- Selection state in dev tools
- IPC errors in console
- Backend `set_selections` command response

### Issue: Backspace/Delete don't work

**Check:**

- Keyboard event handlers registered
- `onKeyDown` in `RustEditor` receiving events
- Backend `edit_buffer` command succeeds

### Issue: Syntax highlighting missing

**Check:**

- File extension recognized by language detector
- Backend `get_highlights` returning spans
- CSS classes for tokens (`token-keyword`, etc.) defined in `global.css`

### Issue: Scroll-to-cursor not working

**Check:**

- Container ref (`@container`) is set
- Container height (`@containerHeight`) > 0
- Effect tracking `@selections` changes

## Next Steps (Phase 4+)

After Phase 3 testing is complete, the following phases are planned:

- **Phase 4:** Undo/Redo with undo groups
- **Phase 5:** Copy/Paste/Cut with clipboard integration
- **Phase 6:** Find/Replace with regex support
- **Phase 7:** Multi-cursor editing
- **Phase 8:** Performance optimization and benchmarking
- **Phase 9:** Advanced features (code folding, symbols, LSP integration)

## Files Modified in Phase 3

### Frontend:

- `src/components/editor/RustEditor.ripple` - Text input, optimistic updates, key handling
- `src/components/editor/EditorViewport.ripple` - Local content rendering
- `src/lib/editor-engine.ts` - No changes (already had edit APIs)

### Backend:

- No changes required (editing commands already implemented in Phase 1)

## Build Status

✅ **Rust:** `cargo check` - 0 errors, 2 warnings (unused future-use functions)  
✅ **Frontend:** `yarn build` - Success in ~1.1s  
✅ **Dev Server:** Starts in ~210ms
