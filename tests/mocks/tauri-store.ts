// Mock Tauri Store plugin
export class Store {
  private data: Map<string, unknown> = new Map();

  constructor(path: string) {
    console.log(`[Mock] Store created: ${path}`);
  }

  async get<T>(key: string): Promise<T | null> {
    return (this.data.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.data.set(key, value);
  }

  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }

  async clear(): Promise<void> {
    this.data.clear();
  }

  async save(): Promise<void> {
    console.log('[Mock] Store saved');
  }
}

export const load = async (path: string) => new Store(path);
