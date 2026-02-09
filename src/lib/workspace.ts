import { fs, git, type FileEntry } from './tauri';
import { editorEngine } from './editor-engine';
import { startFileWatcher, stopFileWatcher, subscribeToFileChanges } from './file-watcher';
import type { DebouncedFileChange } from './file-watcher';

// ============================================================================
// Types
// ============================================================================

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  children: FileTreeNode[] | null;
  isExpanded: boolean;
  isLoading: boolean;
  gitStatus: string | null;
}

export interface OpenFile {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
  /** Special tab type (settings, etc.) - if set, this is not a file tab */
  specialTab?: 'settings' | 'settings-keybindings';
}

export interface CursorPosition {
  line: number;
  column: number;
}

export type LineEnding = 'LF' | 'CRLF' | 'CR';

export interface FileInfo {
  lineEnding: LineEnding;
  encoding: string;
}

// ============================================================================
// Subscription System
// ============================================================================

type ActiveFileCallback = (id: string | null) => void;
type OpenFilesCallback = (files: OpenFile[]) => void;
type CursorPositionCallback = (position: CursorPosition) => void;

const activeFileSubscribers: Set<ActiveFileCallback> = new Set();
const openFilesSubscribers: Set<OpenFilesCallback> = new Set();
const cursorPositionSubscribers: Set<CursorPositionCallback> = new Set();

type WorkspacePathCallback = (path: string | null) => void;
const workspacePathSubscribers: Set<WorkspacePathCallback> = new Set();

type FileTreeChangeCallback = () => void;
const fileTreeChangeSubscribers: Set<FileTreeChangeCallback> = new Set();

type GoToLineCallback = (line: number) => void;
const goToLineSubscribers: Set<GoToLineCallback> = new Set();

type FileInfoCallback = (info: FileInfo) => void;
const fileInfoSubscribers: Set<FileInfoCallback> = new Set();

function notifyFileTreeChangeSubscribers(): void {
  fileTreeChangeSubscribers.forEach((callback) => {
    try {
      callback();
    } catch (err) {
      console.error('[Workspace] File tree change subscriber error:', err);
    }
  });
}

function notifyActiveFileSubscribers(): void {
  activeFileSubscribers.forEach((callback) => callback(activeFileId));
}

function notifyOpenFilesSubscribers(): void {
  openFilesSubscribers.forEach((callback) => callback(openFiles));
}

function notifyCursorPositionSubscribers(): void {
  cursorPositionSubscribers.forEach((callback) => callback(cursorPosition));
}

export function subscribeToActiveFile(callback: ActiveFileCallback): () => void {
  activeFileSubscribers.add(callback);
  return () => {
    activeFileSubscribers.delete(callback);
  };
}

export function subscribeToOpenFiles(callback: OpenFilesCallback): () => void {
  openFilesSubscribers.add(callback);
  return () => {
    openFilesSubscribers.delete(callback);
  };
}

export function subscribeToCursorPosition(callback: CursorPositionCallback): () => void {
  cursorPositionSubscribers.add(callback);
  return () => {
    cursorPositionSubscribers.delete(callback);
  };
}

export function subscribeToWorkspacePath(callback: WorkspacePathCallback): () => void {
  workspacePathSubscribers.add(callback);
  return () => {
    workspacePathSubscribers.delete(callback);
  };
}

/**
 * Subscribe to file tree change events (triggered when the tree is refreshed,
 * e.g. by the file watcher detecting external creates/deletes).
 */
export function subscribeToFileTreeChanges(callback: FileTreeChangeCallback): () => void {
  fileTreeChangeSubscribers.add(callback);
  return () => {
    fileTreeChangeSubscribers.delete(callback);
  };
}

/**
 * Request the editor to navigate to a specific line number.
 * Used by search results, diagnostics, etc.
 */
export function requestGoToLine(line: number): void {
  goToLineSubscribers.forEach((cb) => cb(line));
}

/**
 * Subscribe to go-to-line requests from external sources (search results, etc.).
 */
export function subscribeToGoToLine(callback: GoToLineCallback): () => void {
  goToLineSubscribers.add(callback);
  return () => {
    goToLineSubscribers.delete(callback);
  };
}

/**
 * Subscribe to file info changes (line endings, encoding).
 */
export function subscribeToFileInfo(callback: FileInfoCallback): () => void {
  fileInfoSubscribers.add(callback);
  return () => {
    fileInfoSubscribers.delete(callback);
  };
}

/**
 * Detect line ending type from file content.
 * Optimized to sample only the first 4KB of content for performance.
 * Uses character iteration instead of regex for better performance.
 */
export function detectLineEnding(content: string): LineEnding {
  if (!content) return 'LF';

  // Sample only the first 4KB to avoid scanning entire large files
  const sampleSize = 4096;
  const sample = content.length > sampleSize ? content.slice(0, sampleSize) : content;

  let crlfCount = 0;
  let lfCount = 0;
  let crCount = 0;

  // Use character iteration instead of regex for better performance
  for (let i = 0; i < sample.length; i++) {
    const char = sample[i];
    if (char === '\r') {
      if (i + 1 < sample.length && sample[i + 1] === '\n') {
        crlfCount++;
        i++; // Skip the \n
      } else {
        crCount++;
      }
    } else if (char === '\n') {
      lfCount++;
    }
  }

  if (crlfCount >= lfCount && crlfCount >= crCount) {
    return crlfCount > 0 ? 'CRLF' : 'LF';
  }
  if (crCount > lfCount) return 'CR';
  return 'LF';
}

/**
 * Current file info (line ending + encoding) for the active file.
 */
export let currentFileInfo: FileInfo = { lineEnding: 'LF', encoding: 'UTF-8' };

// Track which file ID we last computed file info for (deduplication)
let lastFileInfoComputedFor: string | null = null;

function notifyFileInfoSubscribers(): void {
  fileInfoSubscribers.forEach((callback) => callback(currentFileInfo));
}

function updateFileInfo(content: string, fileId?: string): void {
  // Skip if we already computed file info for this file
  if (fileId && fileId === lastFileInfoComputedFor) {
    return;
  }

  currentFileInfo = {
    lineEnding: detectLineEnding(content),
    encoding: 'UTF-8', // Tauri reads files as UTF-8
  };

  if (fileId) {
    lastFileInfoComputedFor = fileId;
  }

  notifyFileInfoSubscribers();
}

// ============================================================================
// State (plain arrays - components will use track() locally)
// ============================================================================

// NOTE: DO NOT use track() at module level - it must be inside component context!
// Components should create their own tracked state and sync with these arrays.

// Current workspace root path (set by components)
export let workspacePath: string | null = null;

// Currently active file id (set by components)
export let activeFileId: string | null = null;

// Current cursor position in the active editor
export let cursorPosition: CursorPosition = { line: 1, column: 1 };

// File tree state
export const fileTree: FileTreeNode[] = [];

// Open files in editor
export const openFiles: OpenFile[] = [];

// ============================================================================
// State setters (for use by components)
// ============================================================================

export function setWorkspacePath(path: string | null): void {
  workspacePath = path;
  workspacePathSubscribers.forEach((callback) => callback(path));

  // Start/stop file watcher based on workspace path
  if (path) {
    startFileWatcher(path);
  } else {
    stopFileWatcher();
  }
}

export function setActiveFileId(id: string | null): void {
  console.log('[Workspace] setActiveFileId START:', id);
  activeFileId = id;
  console.log('[Workspace] Notifying active file subscribers');
  notifyActiveFileSubscribers();

  // Update file info for the newly active file
  if (id) {
    const file = openFiles.find((f) => f.id === id);
    if (file && !file.specialTab) {
      console.log('[Workspace] Updating file info for active file');
      updateFileInfo(file.content, file.id);
    }
  }
  console.log('[Workspace] setActiveFileId COMPLETE');
}

export function setCursorPosition(line: number, column: number): void {
  cursorPosition = { line, column };
  notifyCursorPositionSubscribers();
}

// ============================================================================
// Getters
// ============================================================================

export function getActiveFile(): OpenFile | null {
  if (!activeFileId) return null;
  return openFiles.find((f) => f.id === activeFileId) || null;
}

// ============================================================================
// Git Status Integration
// ============================================================================

/**
 * Apply git statuses to file tree nodes by fetching from backend.
 * This runs asynchronously and updates tree nodes in place.
 */
async function applyGitStatuses(wsPath: string): Promise<void> {
  try {
    const statuses = await git.getStatus(wsPath);
    if (Object.keys(statuses).length === 0) return;

    applyStatusesToNodes(fileTree, wsPath, statuses);
    // Notify subscribers so FileTree re-renders with status colors
    notifyFileTreeChangeSubscribers();
  } catch (error) {
    // Git status is optional - don't fail if it errors
    console.warn('[Workspace] Failed to fetch git statuses:', error);
  }
}

/**
 * Recursively apply git statuses to tree nodes.
 * Status map keys are relative paths from the workspace root.
 */
function applyStatusesToNodes(
  nodes: FileTreeNode[],
  wsPath: string,
  statuses: Record<string, string>
): void {
  for (const node of nodes) {
    // Get relative path from workspace root
    const relativePath = node.path.startsWith(wsPath + '/')
      ? node.path.slice(wsPath.length + 1)
      : node.path.startsWith(wsPath + '\\')
        ? node.path.slice(wsPath.length + 1)
        : node.name;

    if (statuses[relativePath]) {
      node.gitStatus = statuses[relativePath];
    }

    // Recurse into loaded children
    if (node.children) {
      applyStatusesToNodes(node.children, wsPath, statuses);
    }
  }
}

// ============================================================================
// File Tree Operations
// ============================================================================

function fileEntryToNode(entry: FileEntry): FileTreeNode {
  return {
    id: entry.path,
    name: entry.name,
    path: entry.path,
    isDirectory: entry.is_directory,
    isSymlink: entry.is_symlink,
    children: entry.is_directory ? null : null,
    isExpanded: false,
    isLoading: false,
    gitStatus: entry.git_status,
  };
}

export async function loadWorkspace(path: string): Promise<void> {
  // This function will be called from Ripple components
  // The workspacePath tracked value should be set using @ syntax in the component
  fileTree.length = 0;

  try {
    const entries = await fs.readDirectory(path);
    const nodes = entries.map((entry) => fileEntryToNode(entry));
    fileTree.push(...nodes);
    notifyFileTreeChangeSubscribers();

    // Overlay git statuses onto tree nodes
    applyGitStatuses(path);
  } catch (error) {
    console.error('Failed to load workspace:', error);
  }
}

export async function loadDirectory(node: FileTreeNode): Promise<void> {
  if (!node.isDirectory || node.children !== null) return;

  node.isLoading = true;

  try {
    const entries = await fs.readDirectory(node.path);
    const children = entries.map((entry) => fileEntryToNode(entry));
    node.children = children;
    notifyFileTreeChangeSubscribers();

    // Apply git statuses to newly loaded children
    if (workspacePath) {
      git
        .getStatus(workspacePath)
        .then((statuses) => {
          if (Object.keys(statuses).length > 0 && node.children) {
            applyStatusesToNodes(node.children, workspacePath!, statuses);
          }
        })
        .catch(() => {
          // Ignore git status errors
        });
    }
  } catch (error) {
    console.error('Failed to load directory:', error);
    node.children = [];
  } finally {
    node.isLoading = false;
  }
}

export async function toggleDirectory(node: FileTreeNode): Promise<FileTreeNode> {
  if (!node.isDirectory) return node;

  // Create a new node object to trigger reactivity
  let updatedNode: FileTreeNode;

  if (!node.isExpanded) {
    if (node.children === null) {
      await loadDirectory(node);
    }
    updatedNode = { ...node, isExpanded: true };
  } else {
    updatedNode = { ...node, isExpanded: false };
  }

  // Update the node in fileTree array
  const index = fileTree.findIndex((n) => n.id === node.id);
  if (index !== -1) {
    fileTree[index] = updatedNode;
  }

  return updatedNode;
}

export async function refreshWorkspace(): Promise<void> {
  fileTree.length = 0;
  if (workspacePath) {
    await loadWorkspace(workspacePath);
  }
  // Notify file tree change subscribers (used by FileTree component)
  // Note: loadWorkspace already notifies for git status, but we notify
  // again here for the general refresh case
  notifyFileTreeChangeSubscribers();
}

// ============================================================================
// File Operations
// ============================================================================

export function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'css',
    less: 'css',
    html: 'html',
    htm: 'html',
    rs: 'rust',
    py: 'python',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    ripple: 'typescript',
  };
  return langMap[ext] || 'text';
}

export async function openFile(path: string, name: string): Promise<void> {
  console.log('[Workspace] openFile START:', path);

  // Check if file is already open
  const existing = openFiles.find((f) => f.path === path);
  if (existing) {
    console.log('[Workspace] File already open, activating:', path);
    // File is already open, just make it active
    setActiveFileId(existing.id);
    return;
  }

  try {
    console.log('[Workspace] Reading file from disk:', path);
    const content = await fs.readFile(path);
    console.log('[Workspace] File read complete, bytes:', content.length);

    const file: OpenFile = {
      id: path,
      path,
      name,
      content,
      isDirty: false,
      language: getLanguageFromPath(path),
    };

    console.log('[Workspace] Adding file to openFiles array');
    openFiles.push(file);
    console.log('[Workspace] Notifying subscribers');
    notifyOpenFilesSubscribers();

    // Shadow Mode: Open buffer in Rust engine
    console.log('[Workspace] Calling editorEngine.openBuffer');
    editorEngine
      .openBuffer(path)
      .then((info) => {
        console.log('[Workspace] editorEngine.openBuffer resolved:', info);
      })
      .catch((err) => {
        console.warn('[Workspace] Failed to open shadow buffer in Rust:', err);
      });

    // Detect line ending info for the new file
    console.log('[Workspace] Updating file info');
    updateFileInfo(content, file.id);

    // Set the newly opened file as active
    console.log('[Workspace] Setting active file ID');
    setActiveFileId(file.id);
    console.log('[Workspace] openFile COMPLETE:', path);
  } catch (error) {
    console.error('Failed to open file:', error);
  }
}

export async function saveFile(id: string): Promise<void> {
  const file = openFiles.find((f) => f.id === id);
  if (!file) return;

  try {
    await fs.writeFile(file.path, file.content);
    file.isDirty = false;
    notifyOpenFilesSubscribers();
  } catch (error) {
    console.error('Failed to save file:', error);
  }
}

export function closeFile(id: string): void {
  const index = openFiles.findIndex((f) => f.id === id);
  if (index === -1) return;

  const wasActive = activeFileId === id;

  // Reset file info tracking if we're closing the file we computed for
  // This ensures if the file is externally modified and reopened, we recompute
  if (id === lastFileInfoComputedFor) {
    lastFileInfoComputedFor = null;
  }

  openFiles.splice(index, 1);
  notifyOpenFilesSubscribers();

  // Shadow Mode: Close buffer in Rust engine
  editorEngine.closeBuffer(id).catch((err) => {
    console.warn('[Workspace] Failed to close shadow buffer in Rust:', err);
  });

  // If we closed the active file, select a new one
  if (wasActive) {
    if (openFiles.length === 0) {
      setActiveFileId(null);
    } else {
      // Select the file at the same position, or the last one if we closed the last tab
      const newIndex = Math.min(index, openFiles.length - 1);
      setActiveFileId(openFiles[newIndex].id);
    }
  }
}

export function updateFileContent(id: string, content: string): void {
  const file = openFiles.find((f) => f.id === id);
  if (!file) return;

  file.content = content;
  file.isDirty = true;
  notifyOpenFilesSubscribers();
}

// Legacy function - kept for backwards compatibility
export function setActiveFile(id: string): void {
  setActiveFileId(id);
}

// ============================================================================
// Tab Navigation
// ============================================================================

/**
 * Switch to the next tab (wraps around to first if at end)
 */
export function nextTab(): void {
  if (openFiles.length <= 1) return;

  const currentIndex = openFiles.findIndex((f) => f.id === activeFileId);
  if (currentIndex === -1) {
    // No active file, select the first one
    setActiveFileId(openFiles[0].id);
    return;
  }

  const nextIndex = (currentIndex + 1) % openFiles.length;
  setActiveFileId(openFiles[nextIndex].id);
}

/**
 * Switch to the previous tab (wraps around to last if at beginning)
 */
export function previousTab(): void {
  if (openFiles.length <= 1) return;

  const currentIndex = openFiles.findIndex((f) => f.id === activeFileId);
  if (currentIndex === -1) {
    // No active file, select the last one
    setActiveFileId(openFiles[openFiles.length - 1].id);
    return;
  }

  const prevIndex = (currentIndex - 1 + openFiles.length) % openFiles.length;
  setActiveFileId(openFiles[prevIndex].id);
}

/**
 * Switch to a specific tab by index (1-based, like Alt+1, Alt+2, etc.)
 */
export function goToTab(index: number): void {
  if (index < 1 || index > openFiles.length) return;
  setActiveFileId(openFiles[index - 1].id);
}

/**
 * Reorder a tab from one index to another (used for drag-and-drop)
 */
export function reorderTab(fromIndex: number, toIndex: number): void {
  if (
    fromIndex < 0 ||
    fromIndex >= openFiles.length ||
    toIndex < 0 ||
    toIndex >= openFiles.length ||
    fromIndex === toIndex
  ) {
    return;
  }

  const [moved] = openFiles.splice(fromIndex, 1);
  openFiles.splice(toIndex, 0, moved);
  notifyOpenFilesSubscribers();
}

// ============================================================================
// Special Tabs (Settings, etc.)
// ============================================================================

export type SpecialTabType = 'settings' | 'settings-keybindings';

const SPECIAL_TAB_IDS: Record<SpecialTabType, string> = {
  settings: '__settings__',
  'settings-keybindings': '__settings-keybindings__',
};

const SPECIAL_TAB_NAMES: Record<SpecialTabType, string> = {
  settings: 'Settings',
  'settings-keybindings': 'Keyboard Shortcuts',
};

/**
 * Open a special tab (like Settings)
 */
export function openSpecialTab(type: SpecialTabType): void {
  const id = SPECIAL_TAB_IDS[type];

  // Check if already open
  const existing = openFiles.find((f) => f.id === id);
  if (existing) {
    setActiveFileId(id);
    return;
  }

  const tab: OpenFile = {
    id,
    path: '',
    name: SPECIAL_TAB_NAMES[type],
    content: '',
    isDirty: false,
    language: '',
    specialTab: type,
  };

  openFiles.push(tab);
  notifyOpenFilesSubscribers();
  setActiveFileId(id);
}

/**
 * Check if a tab is a special tab
 */
export function isSpecialTab(file: OpenFile): boolean {
  return !!file.specialTab;
}

/**
 * Open Settings tab
 */
export function openSettings(): void {
  openSpecialTab('settings');
}

/**
 * Open Keybindings Settings tab
 */
export function openKeybindingsSettings(): void {
  openSpecialTab('settings-keybindings');
}

// ============================================================================
// Create/Delete Operations
// ============================================================================

export async function createNewFile(parentPath: string, name: string): Promise<void> {
  const filePath = `${parentPath}/${name}`;
  try {
    await fs.createFile(filePath);
  } catch (error) {
    console.error('Failed to create file:', error);
  }
}

export async function createNewDirectory(parentPath: string, name: string): Promise<void> {
  const dirPath = `${parentPath}/${name}`;
  try {
    await fs.createDirectory(dirPath);
  } catch (error) {
    console.error('Failed to create directory:', error);
  }
}

export async function deletePath(path: string): Promise<void> {
  try {
    await fs.deletePath(path);

    const file = openFiles.find((f) => f.path === path);
    if (file) {
      closeFile(file.id);
    }
  } catch (error) {
    console.error('Failed to delete:', error);
  }
}

export async function renamePath(oldPath: string, newPath: string): Promise<void> {
  try {
    await fs.renamePath(oldPath, newPath);

    const file = openFiles.find((f) => f.path === oldPath);
    if (file) {
      file.path = newPath;
      file.name = newPath.split('/').pop() || file.name;
      file.id = newPath;
      notifyOpenFilesSubscribers();
    }
  } catch (error) {
    console.error('Failed to rename:', error);
  }
}

// ============================================================================
// File Watcher Integration
// ============================================================================

/**
 * Reload open files that were modified externally.
 * Only reloads files that are not dirty (no unsaved user edits).
 */
async function reloadExternallyModifiedFiles(changedPaths: string[]): Promise<void> {
  let reloaded = false;

  for (const file of openFiles) {
    // Skip special tabs and untitled files
    if (file.specialTab || !file.path) continue;
    // Skip files not in the changed set
    if (!changedPaths.includes(file.path)) continue;
    // Don't overwrite unsaved changes
    if (file.isDirty) continue;

    try {
      const content = await fs.readFile(file.path);
      file.content = content;
      reloaded = true;
    } catch (err) {
      console.error('[Workspace] Failed to reload file:', file.path, err);
    }
  }

  if (reloaded) {
    notifyOpenFilesSubscribers();
  }
}

// Subscribe to file watcher events at module level
subscribeToFileChanges((change: DebouncedFileChange) => {
  // Refresh file tree for structural changes (new/deleted files)
  if (change.hasCreates || change.hasRemoves) {
    refreshWorkspace();
  }
  // Reload open files for content changes
  if (change.hasModifies) {
    reloadExternallyModifiedFiles(change.changedPaths);
  }
});

// ============================================================================
// File Dialog Operations
// ============================================================================

/**
 * Open a native file open dialog and open the selected file
 */
export async function openFileDialog(): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      title: 'Open File',
    });

    if (selected) {
      const filePath = selected;
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
      await openFile(filePath, name);
    }
  } catch (error) {
    console.error('Failed to open file dialog:', error);
  }
}

/**
 * Open a native folder open dialog and set it as the workspace
 */
export async function openFolderDialog(): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Open Folder',
    });

    if (selected && typeof selected === 'string') {
      setWorkspacePath(selected);
    }
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
  }
}

/**
 * Create a new untitled file and open it in the editor
 */
export function newUntitledFile(): void {
  // Generate a unique untitled file ID
  const untitledCount = openFiles.filter((f) => f.name.startsWith('Untitled')).length;
  const name = untitledCount === 0 ? 'Untitled' : `Untitled-${untitledCount + 1}`;
  const id = `__untitled__${Date.now()}`;

  const file: OpenFile = {
    id,
    path: '',
    name,
    content: '',
    isDirty: true,
    language: 'text',
  };

  openFiles.push(file);
  notifyOpenFilesSubscribers();
  setActiveFileId(id);
}

/**
 * Save the current file with a new name/path via native save dialog
 */
export async function saveFileAs(id: string): Promise<void> {
  const file = openFiles.find((f) => f.id === id);
  if (!file) return;

  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const savePath = await save({
      title: 'Save As',
      defaultPath: file.path || file.name,
    });

    if (savePath) {
      await fs.writeFile(savePath, file.content);

      // Update the file entry with the new path
      const oldId = file.id;
      file.path = savePath;
      file.name = savePath.split('/').pop() || savePath.split('\\').pop() || savePath;
      file.id = savePath;
      file.isDirty = false;
      file.language = getLanguageFromPath(savePath);

      // If this was the active file, update active file ID
      if (activeFileId === oldId) {
        activeFileId = savePath;
        notifyActiveFileSubscribers();
      }

      notifyOpenFilesSubscribers();
    }
  } catch (error) {
    console.error('Failed to save file as:', error);
  }
}
