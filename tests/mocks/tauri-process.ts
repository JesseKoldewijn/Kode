// Mock Tauri Process plugin
export const exit = async (code?: number) => {
  console.log(`[Mock] exit: ${code ?? 0}`);
};

export const relaunch = async () => {
  console.log('[Mock] relaunch');
};
