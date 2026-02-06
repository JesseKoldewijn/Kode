// Mock Tauri Shell plugin
export const Command = {
  create: (program: string, args?: string[]) => ({
    execute: async () => ({ code: 0, stdout: '', stderr: '' }),
    spawn: async () => ({
      pid: 12345,
      kill: async () => {},
      write: async (data: string) => {},
    }),
    on: (event: string, handler: (data: unknown) => void) => {},
  }),
};

export const open = async (path: string, openWith?: string) => {
  console.log(`[Mock] open: ${path}`);
};
