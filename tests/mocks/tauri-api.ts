// Mock Tauri core API
export const invoke = async (cmd: string, args?: Record<string, unknown>) => {
  console.log(`[Mock] invoke: ${cmd}`, args);
  return null;
};

export const event = {
  listen: async (event: string, handler: (payload: unknown) => void) => {
    console.log(`[Mock] listen: ${event}`);
    return () => {};
  },
  emit: async (event: string, payload?: unknown) => {
    console.log(`[Mock] emit: ${event}`, payload);
  },
};

export const window = {
  getCurrentWindow: () => ({
    listen: async () => () => {},
    emit: async () => {},
  }),
};
