// Mock Tauri Log plugin
export const trace = (message: string) => console.log(`[TRACE] ${message}`);
export const debug = (message: string) => console.log(`[DEBUG] ${message}`);
export const info = (message: string) => console.log(`[INFO] ${message}`);
export const warn = (message: string) => console.warn(`[WARN] ${message}`);
export const error = (message: string) => console.error(`[ERROR] ${message}`);
