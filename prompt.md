# Kode Editor -- Viewport Reactivity & Scroll Bugs

## Symptoms

1. **Content stays pinned to first file**: When switching tabs, the file name (tabs, breadcrumbs) and the gutter line numbers update, but the **EditorViewport text content remains the content of the first file opened**. The LSP language badge on the status bar also updates correctly.

2. **Scrolling doesn't work properly**: Scrolling through an open file either doesn't update the viewport or behaves inconsistently.

---

## Root Cause Analysis

### Bug 1: Viewport content not updating on file switch

The problem is in `EditorViewport.ripple` at **lines 139-176**. Several critical computations happen as **bare `const` statements in the component body**, outside of any `effect()` or reactive context:

```
// EditorViewport.ripple, lines 139-176
const contentLines = @content ? @content.split('\n') : [];
const logicalTotalLines = contentLines.length > 0 ? contentLines.length : ...;
const foldedSet = new Set<number>(props.foldedStartLines);
const activeFoldedRanges = (props.foldRanges || []).filter(...);
const visibleLineNumbers = (() => { ... })();
const totalHeight = visibleLineNumbers.length * props.lineHeight;
const startIndex = Math.floor(props.scrollTop / props.lineHeight);
```

**In Ripple, `const` statements at the top level of a component body are only evaluated once at mount time.** They are NOT re-evaluated when tracked dependencies change. This means:

- `contentLines` splits `@content` at mount, but when `@content` changes (new file), this line never re-runs.
- `startIndex` reads `props.scrollTop` at mount, but never updates when scroll position changes.
- `visibleLineNumbers` is computed once and never recomputed.
- `totalHeight` is computed once -- the viewport never resizes for a new file's line count.

The `getLineText()` function (line 178) reads from the stale `contentLines` closure, so even though `@cachedLines` is updated correctly by the effect on line 34, the template's `for` loop calls `getLineText()` which first checks the stale `contentLines` array and returns lines from the original file.

Similarly, `getVisibleLineNumbers()` (line 191) uses the stale `startIndex` and `visibleLineNumbers`, so the same set of line numbers is always returned regardless of scroll position.

**The fix**: These computations need to either:

- Be wrapped in `track(() => ...)` computed values so they reactively update, OR
- Be moved inside `effect()` blocks that write to tracked variables, OR
- Be moved inside the template itself where Ripple re-evaluates them on each render cycle (but this is fragile and hard to reason about)

The best approach per Ripple's model is to convert them to reactive computations:

```typescript
let contentLines = track(() => {
  const c = @content;
  return c ? c.split('\n') : [];
});

let logicalTotalLines = track(() => {
  const lines = @contentLines;
  return lines.length > 0
    ? lines.length
    : (@cachedLines.length > 0 ? @cachedLines.length : (@highlights?.totalLines || 0));
});

// ... and so on for visibleLineNumbers, totalHeight, startIndex
```

Then in the template, read them with `@contentLines`, `@logicalTotalLines`, etc.

### Bug 2: Scrolling doesn't work

This is a direct consequence of the same root cause. The `startIndex` value:

```
const startIndex = Math.floor(props.scrollTop / props.lineHeight);
```

...is computed once at mount. It reads `props.scrollTop` but since this is a bare `const`, it captures the initial value (0) and never updates. The scroll handler in `RustEditor.ripple` correctly updates `@scrollTop` (line 160), which is passed down as `props.scrollTop` to the viewport, but the viewport never re-derives `startIndex` from it.

This means `getVisibleLineNumbers()` always returns lines starting from index 0, and the `translateY` transform:

```
style={{ transform: `translateY(${startIndex * props.lineHeight}px)` }}
```

...stays at `translateY(0px)` forever.

**Additionally**, the highlight fetching effect (line 96-127) reads `props.scrollTop` and `props.viewportHeight` directly:

```typescript
const startLine = Math.floor(props.scrollTop / props.lineHeight);
const endLine = startLine + Math.ceil(props.viewportHeight / props.lineHeight) + 1;
```

In Ripple, `props.*` accesses on non-trackSplit'd props are **not reactive**. Only `@content` and `@bufferIdProp` (extracted via `trackSplit` on line 19) are reactive. The remaining props (`scrollTop`, `viewportHeight`, `lineHeight`, `selections`, `foldRanges`, `foldedStartLines`, `wordWrap`) are read as **plain prop accesses**, which means:

- Effects that depend on `props.scrollTop` will **not** re-run when `scrollTop` changes.
- The template reads of `props.scrollTop` also won't trigger re-renders.

**The fix**: Either:

1. Include `scrollTop`, `viewportHeight`, and other changing props in the `trackSplit` call so they become reactive, OR
2. Use a different strategy where the parent passes tracked references directly.

The `trackSplit` call should look like:

```typescript
const [content, bufferIdProp, scrollTopProp, viewportHeightProp, rest] = trackSplit(props, [
  'content',
  'bufferId',
  'scrollTop',
  'viewportHeight',
]);
```

Then use `@scrollTopProp` and `@viewportHeightProp` throughout.

---

## Files to Change

### 1. `src/components/editor/EditorViewport.ripple`

This is the primary file with issues:

- **Line 19**: Expand `trackSplit` to include `scrollTop`, `viewportHeight`, `selections`, `foldRanges`, `foldedStartLines`, `wordWrap` -- or at minimum `scrollTop` and `viewportHeight`.
- **Lines 139-176**: Convert bare `const` computations to reactive `track(() => ...)` computations. Specifically:
  - `contentLines` -> `let contentLines = track(() => ...)`
  - `logicalTotalLines` -> `let logicalTotalLines = track(() => ...)`
  - `foldedSet`, `activeFoldedRanges` -> reactive computed
  - `visibleLineNumbers` -> `let visibleLineNumbers = track(() => ...)`
  - `totalHeight` -> `let totalHeight = track(() => ...)`
  - `startIndex` -> `let startIndex = track(() => ...)`
- **Lines 109-110**: Use tracked versions of scrollTop/viewportHeight/lineHeight in the highlight effect.
- **Lines 175-176**: Use tracked versions in the template's `style` attribute and in `getVisibleLineNumbers()`.
- **Line 178-189**: `getLineText` should read from `@contentLines` (tracked) instead of the stale closure `contentLines`.
- **Lines 191-199**: `getVisibleLineNumbers` should read from `@startIndex`, `@visibleLineNumbers` (tracked), and tracked viewportHeight/lineHeight.
- **Line 257**: The `translateY` transform should use `@startIndex` and tracked lineHeight.

### 2. `src/components/editor/RustEditor.ripple`

Secondary issues that may contribute:

- **Line 830**: The `for (const fid of [@file?.id ?? '']; key fid)` pattern is a hack to force the EditorViewport to remount when the file changes. This works around the reactivity issue but is fragile -- if the viewport's internal state was properly reactive, this wouldn't be needed. Evaluate whether to keep it or remove it once the viewport is fixed.
- **Line 806-807**: `editorContent` is computed as a bare `const` in the template. In Ripple, template-level computations are re-evaluated on re-render, but only if a tracked dependency in the same template block triggers a re-render. Verify that `@file`, `@currentFileId`, `@localContent` changes actually cause this block to re-evaluate.
- **Line 812**: `scrollTotalLines * 20` provides the scroll height for the outer container. If this doesn't update reactively, the scrollable area won't match the file length.
- **Lines 159-161**: The `onScroll` handler updates `@scrollTop`, which is correct. But verify the scroll container (`overflow-y-auto` on line 805) is actually scrollable -- the child `div` at line 812 needs to have the correct computed height.

### 3. `src/components/layout/EditorArea.ripple`

- **Line 233**: The `<RustEditor key={currentFile.id} ...>` pattern remounts the editor entirely on file switch. This is expensive and also resets all internal state. If the viewport's reactivity is fixed, a single RustEditor instance could handle file switches without remounting. However, as-is, the `key` pattern should at least ensure a fresh mount per file -- verify this works with the `for (const fid of ...)` pattern in RustEditor.

---

## Bug 3: FileTree UI is not dynamic/responsive

The sidebar file tree does not adapt properly when the sidebar is resized. File names and toolbar icons overflow or clip awkwardly instead of truncating gracefully. The explorer content does not fill the available width.

### Root Cause

The issue is a chain of missing width/overflow constraints flowing from `Sidebar.ripple` down through `FileTree.ripple`:

**Sidebar.ripple (line 147-150):**

```
<div class="flex h-full bg-sidebar-bg flex-1 min-w-0 overflow-hidden">
    <div class={{ 'flex flex-col h-full': true, hidden: @props.activeTab !== 'explorer' }}>
      <FileTree />
    </div>
```

The outer wrapper uses `flex` and `min-w-0` but the tab content `<div>` for each tab (explorer at line 148, search at line 152, git at line 304) is missing `w-full`, `flex-1`, `min-w-0`, and `overflow-hidden`. Without these, the content doesn't fill the sidebar width and cannot properly constrain its children.

**FileTree.ripple (line 290):**

```
<div class="py-1 h-full overflow-y-auto" data-testid="filetree">
```

Missing `w-full` and `min-w-0`. The file tree container doesn't claim the full sidebar width, so child elements can push beyond the sidebar boundary.

**FileTree.ripple toolbar (lines 291-342):**
The `EXPLORER` header with action buttons uses `px-4` padding but has no `min-w-0` or `overflow-hidden` on its container, so at narrow sidebar widths the buttons can clip or overlap the text.

**FileNodeRow.ripple (line 52-58):**

```
<div
  class={{ 'flex items-center h-[22px] cursor-pointer text-[13px]...': true, ... }}
  style={{ paddingLeft: `${paddingLeft}px` }}
>
```

The row itself doesn't have `min-w-0` or `overflow-hidden`. While the filename `<span>` at line 112 has `truncate` (which includes `overflow-hidden text-overflow-ellipsis whitespace-nowrap`), the parent flex container needs `min-w-0` for `truncate` to actually work -- without it, the flex item won't shrink below its content size and the text won't truncate.

**FileNodeRow.ripple (line 10):**

```
const paddingLeft = 12 + props.depth * 16;
```

This is a bare `const` -- in Ripple, this is only evaluated once at mount. If `props.depth` were to change (unlikely for file tree, but worth noting), it would not update. More importantly, deeply nested files push the padding so far right that the filename becomes invisible at narrow widths. There's no maximum depth cap or adaptive padding.

### Fix

1. **Sidebar.ripple** -- Add `w-full flex-1 min-w-0 overflow-hidden` to each tab content `<div>`:

   ```
   <div class={{ 'flex flex-col h-full w-full flex-1 min-w-0 overflow-hidden': true, hidden: ... }}>
   ```

2. **FileTree.ripple** -- Add `w-full min-w-0` to root container:

   ```
   <div class="py-1 h-full w-full min-w-0 overflow-y-auto overflow-x-hidden">
   ```

3. **FileTree.ripple toolbar** -- Add `min-w-0 overflow-hidden` to the header row so buttons don't clip at narrow widths. Consider making the "EXPLORER" label `truncate` as well.

4. **FileNodeRow.ripple** -- Add `min-w-0 overflow-hidden` to the root `<div>` so the flex layout can actually shrink:

   ```
   'flex items-center h-[22px] min-w-0 overflow-hidden cursor-pointer...'
   ```

5. **FileNodeRow.ripple** -- Consider capping `paddingLeft` at a max value (e.g. `Math.min(paddingLeft, sidebarWidth * 0.4)`) or switching to a CSS-based indent approach that respects container width.

6. **FileTree.ripple inner containers** (lines 376, 389, 398) -- The `<div class="px-1">` and nested divs need `min-w-0 overflow-hidden` so deeply nested rows truncate instead of overflowing.

### Files to Change

- `src/components/layout/Sidebar.ripple` -- lines 147-150, 152, 304
- `src/components/filetree/FileTree.ripple` -- lines 290, 291-292, 376, 389, 398
- `src/components/filetree/FileNodeRow.ripple` -- lines 52-58, 10

---

## Debugging Strategy: Browser MCP

All verification and debugging MUST be done using the **browser MCP** (cursor-ide-browser). The app runs via `yarn dev` on `http://localhost:1420` and can be tested in-browser without Tauri thanks to the mock system.

### Workflow

1. **Start the dev server** if not already running: `yarn dev` (runs on port 1420).
2. **Navigate** to `http://localhost:1420` using `browser_navigate`.
3. **Take snapshots** with `browser_snapshot` to inspect the DOM structure and find element refs before interacting.
4. **Interact** with the app to reproduce bugs:
   - Click files in the sidebar file tree to open them.
   - Click different tabs in the editor tab bar to switch files.
   - Use `browser_scroll` or mouse wheel simulation to test scrolling.
5. **Check console logs** with `browser_get_console_logs` to look for:
   - Ripple reactivity warnings or errors.
   - `[EditorViewport]` or `[RustEditor]` log output from the existing `console.error`/`console.warn` calls.
   - Any `Illegal invocation` or component mount/unmount errors.
6. **Take screenshots** with `browser_screenshot` to visually confirm:
   - Whether the viewport text actually changes when switching tabs.
   - Whether the scroll position visually moves when scrolling.
   - Whether the gutter line numbers match the visible content.
7. **Inspect specific elements** by taking a snapshot and looking for `data-testid` attributes:
   - `data-testid="editor-viewport"` -- the viewport container.
   - `data-editor-buffer-id="..."` -- should change when the active file changes.
   - `data-testid="editor-tabs"` -- tab bar for switching files.
   - `data-testid="editor-minimap"` -- minimap should track scroll.
8. **Use incremental waits** (1-3 seconds) with snapshot checks between interactions rather than long waits, to catch the exact moment reactivity fails.

### What to Verify with Browser MCP

After each code change, use the browser MCP to confirm:

| Check                             | How to Verify                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| Content updates on tab switch     | Open file A, open file B, click tab A -- screenshot should show file A's content, not B's         |
| Scrolling works                   | Open a long file, scroll down -- screenshot should show lines further into the file, not the top  |
| Gutter stays in sync              | After scrolling, snapshot the gutter -- line numbers should reflect the scroll offset             |
| Minimap tracks scroll             | After scrolling, screenshot -- minimap viewport indicator should move                             |
| Highlights load for visible range | After scrolling to a new section, check console for highlight fetch calls covering the new range  |
| No stale content flicker          | Switch files rapidly -- no frames should show the wrong file's content                            |
| FileTree fills sidebar width      | Resize sidebar narrower/wider -- file names should truncate with ellipsis, no horizontal overflow |
| FileTree deeply nested nodes      | Expand nested directories -- names should still be visible and truncate, not push off-screen      |
| FileTree toolbar responsive       | Resize sidebar very narrow -- EXPLORER label and action buttons should stay within bounds         |

### Console Log Instrumentation

Consider temporarily adding targeted `console.log` statements to trace reactivity:

```typescript
// In EditorViewport.ripple -- add inside the content caching effect
effect(() => {
  const c = @content;
  console.log('[EditorViewport] content changed, length:', c?.length, 'bufferId:', @bufferIdProp);
  // ...
});

// In EditorViewport.ripple -- add to verify startIndex updates
// (After converting startIndex to track(() => ...))
effect(() => {
  console.log('[EditorViewport] startIndex:', @startIndex, 'scrollTop:', @scrollTopProp);
});
```

Check these with `browser_get_console_logs` after each interaction to confirm reactive updates are firing.

---

## Verification Steps

After making changes:

1. Open two files via the file tree. Switch between them -- content in the viewport should update.
2. Scroll down in a file with many lines -- viewport should show different lines and the gutter should reflect the scroll position.
3. Switch to a different file, then switch back -- content should be correct for each file, and scroll position should reset to 0 (or be restored if implementing scroll memory).
4. Open the find overlay (Ctrl+F) -- it should search the current file, not the first file.
5. Type in the editor -- edits should appear in the correct file.
6. Check that the minimap position indicator tracks scrolling.

**All of these steps should be performed using the browser MCP**, not just manual testing.

---

## Ripple Framework Notes

Key Ripple behaviors relevant to these bugs:

- **`const` in component body** = evaluated once at mount. NOT reactive.
- **`let x = track(value)`** = reactive variable, read with `@x`, write with `@x = ...`.
- **`let x = track(() => expr)`** = reactive computed, re-evaluates when tracked deps in `expr` change.
- **`effect(() => { ... })`** = side effect, re-runs when tracked deps change.
- **`trackSplit(props, [keys])`** = extracts named props as reactive `Tracked` values. Non-extracted props are plain (non-reactive) snapshots.
- **`props.foo`** in effects/template = reads the initial value, not reactive. Must use `trackSplit` or pass `Tracked` references for reactivity.
- **Template code** inside a component is re-evaluated when any tracked variable read in the same block changes, but `const` values computed before the template are closures over stale data.
