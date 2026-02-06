/**
 * Filesystem Mock Handlers
 *
 * Provides mock implementations for all filesystem-related Tauri commands
 * when running in browser mode.
 */

import {
  getMockDirectoryChildren,
  getMockFileContent,
  searchMockFiles,
  searchMockContent,
  findMockFile,
  getDemoWorkspacePath,
  type MockFile,
} from './data/sample-project';

// In-memory storage for file modifications during the session
const fileStore = new Map<string, string>();
const deletedPaths = new Set<string>();
const createdFiles = new Map<string, MockFile>();

/**
 * Convert MockFile to FileEntry format expected by the app
 */
function toFileEntry(file: MockFile): {
  name: string;
  path: string;
  is_directory: boolean;
  is_symlink: boolean;
  size: number | null;
  modified: number | null;
  git_status: string | null;
} {
  return {
    name: file.name,
    path: file.path,
    is_directory: file.isDirectory,
    is_symlink: file.isSymlink,
    size: file.size,
    modified: file.modified,
    git_status: file.gitStatus,
  };
}

/**
 * Handle filesystem commands
 */
export function handleFilesystemCommand(cmd: string, args: Record<string, unknown>): unknown {
  switch (cmd) {
    case 'read_directory':
      return handleReadDirectory(args.path as string);

    case 'read_file':
      return handleReadFile(args.path as string);

    case 'write_file':
      return handleWriteFile(args.path as string, args.content as string);

    case 'create_file':
      return handleCreateFile(args.path as string, args.content as string | undefined);

    case 'create_directory':
      return handleCreateDirectory(args.path as string);

    case 'delete_path':
      return handleDeletePath(args.path as string);

    case 'rename_path':
      return handleRenamePath(args.oldPath as string, args.newPath as string);

    case 'search_files':
      return handleSearchFiles(
        args.root as string,
        args.query as string,
        args.maxResults as number | undefined
      );

    case 'search_content':
      return handleSearchContent(
        args.root as string,
        args.query as string,
        args.maxResults as number | undefined
      );

    default:
      console.warn(`[Mock FS] Unhandled command: ${cmd}`);
      return null;
  }
}

function handleReadDirectory(path: string): unknown {
  console.log(`[Mock FS] readDirectory called with path: ${path}`);

  // Check if the path is actually a file (common error)
  const node = findMockFile(path);
  if (node && !node.isDirectory) {
    console.error(`[Mock FS] ERROR: Attempted to readDirectory on a file: ${path}`);
    throw new Error(`Not a directory: ${path} (this is a file)`);
  }

  // Check for runtime-created directories
  const createdInPath = Array.from(createdFiles.values()).filter(
    (f) => f.path.startsWith(path + '/') && !f.path.slice(path.length + 1).includes('/')
  );

  // Get mock children
  const mockChildren = getMockDirectoryChildren(path);

  if (!mockChildren && createdInPath.length === 0) {
    // If the path doesn't exist but wasn't created, it's an error
    // But for the demo workspace root, we'll be lenient
    if (path === getDemoWorkspacePath() || path === '/demo-project') {
      const demoChildren = getMockDirectoryChildren('/demo-project');
      console.log(`[Mock FS] Returning demo workspace root: ${demoChildren?.length || 0} entries`);
      return demoChildren?.map(toFileEntry) || [];
    }
    console.error(`[Mock FS] Directory not found: ${path}`);
    throw new Error(`Directory not found: ${path}`);
  }

  const entries = (mockChildren || []).filter((f) => !deletedPaths.has(f.path)).map(toFileEntry);

  // Add runtime-created files
  for (const created of createdInPath) {
    if (!deletedPaths.has(created.path)) {
      entries.push(toFileEntry(created));
    }
  }

  console.log(`[Mock FS] readDirectory: ${path} -> ${entries.length} entries`);
  return entries;
}

function handleReadFile(path: string): string {
  // Check in-memory store first (for modifications)
  if (fileStore.has(path)) {
    console.log(`[Mock FS] readFile: ${path} (from store)`);
    return fileStore.get(path)!;
  }

  // Check runtime-created files
  if (createdFiles.has(path)) {
    console.log(`[Mock FS] readFile: ${path} (created file)`);
    return createdFiles.get(path)!.content || '';
  }

  // Get from mock data
  const content = getMockFileContent(path);
  if (content === null) {
    throw new Error(`File not found: ${path}`);
  }

  console.log(`[Mock FS] readFile: ${path}`);
  return content;
}

function handleWriteFile(path: string, content: string): void {
  fileStore.set(path, content);
  console.log(`[Mock FS] writeFile: ${path} (${content.length} bytes)`);
}

function handleCreateFile(path: string, content?: string): void {
  const name = path.split('/').pop() || 'untitled';
  const newFile: MockFile = {
    name,
    path,
    isDirectory: false,
    isSymlink: false,
    size: content?.length || 0,
    modified: Date.now(),
    gitStatus: 'A',
    content: content || '',
  };
  createdFiles.set(path, newFile);
  if (content) {
    fileStore.set(path, content);
  }
  console.log(`[Mock FS] createFile: ${path}`);
}

function handleCreateDirectory(path: string): void {
  const name = path.split('/').pop() || 'untitled';
  const newDir: MockFile = {
    name,
    path,
    isDirectory: true,
    isSymlink: false,
    size: 0,
    modified: Date.now(),
    gitStatus: null,
    children: [],
  };
  createdFiles.set(path, newDir);
  console.log(`[Mock FS] createDirectory: ${path}`);
}

function handleDeletePath(path: string): void {
  deletedPaths.add(path);
  fileStore.delete(path);
  createdFiles.delete(path);
  console.log(`[Mock FS] deletePath: ${path}`);
}

function handleRenamePath(oldPath: string, newPath: string): void {
  // Get old content if it exists
  const oldContent = fileStore.get(oldPath) || getMockFileContent(oldPath);
  const oldFile = createdFiles.get(oldPath) || findMockFile(oldPath);

  // Mark old as deleted
  deletedPaths.add(oldPath);
  fileStore.delete(oldPath);
  createdFiles.delete(oldPath);

  // Create at new location
  const name = newPath.split('/').pop() || 'untitled';
  const newFile: MockFile = {
    name,
    path: newPath,
    isDirectory: oldFile?.isDirectory || false,
    isSymlink: false,
    size: oldContent?.length || 0,
    modified: Date.now(),
    gitStatus: 'M',
    content: oldContent || undefined,
  };
  createdFiles.set(newPath, newFile);
  if (oldContent) {
    fileStore.set(newPath, oldContent);
  }

  console.log(`[Mock FS] renamePath: ${oldPath} -> ${newPath}`);
}

function handleSearchFiles(_root: string, query: string, maxResults?: number): unknown {
  const results = searchMockFiles(query, maxResults);
  console.log(`[Mock FS] searchFiles: "${query}" -> ${results.length} results`);
  return results;
}

function handleSearchContent(_root: string, query: string, maxResults?: number): unknown {
  const results = searchMockContent(query, maxResults);
  console.log(`[Mock FS] searchContent: "${query}" -> ${results.length} results`);
  return results;
}

/**
 * Reset the mock filesystem state (useful for tests)
 */
export function resetFilesystemMocks(): void {
  fileStore.clear();
  deletedPaths.clear();
  createdFiles.clear();
}

/**
 * Get the demo workspace path
 */
export { getDemoWorkspacePath };
