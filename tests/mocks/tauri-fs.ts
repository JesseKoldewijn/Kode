// Mock Tauri FS plugin
export const readDir = async (path: string) => {
  console.log(`[Mock] readDir: ${path}`);
  return [];
};

export const readTextFile = async (path: string) => {
  console.log(`[Mock] readTextFile: ${path}`);
  return '';
};

export const writeTextFile = async (path: string, contents: string) => {
  console.log(`[Mock] writeTextFile: ${path}`);
};

export const exists = async (path: string) => {
  console.log(`[Mock] exists: ${path}`);
  return false;
};

export const mkdir = async (path: string, options?: { recursive?: boolean }) => {
  console.log(`[Mock] mkdir: ${path}`);
};

export const remove = async (path: string, options?: { recursive?: boolean }) => {
  console.log(`[Mock] remove: ${path}`);
};

export const rename = async (oldPath: string, newPath: string) => {
  console.log(`[Mock] rename: ${oldPath} -> ${newPath}`);
};

export const copyFile = async (source: string, destination: string) => {
  console.log(`[Mock] copyFile: ${source} -> ${destination}`);
};

export const stat = async (path: string) => {
  console.log(`[Mock] stat: ${path}`);
  return { isDirectory: false, isFile: true, size: 0 };
};
