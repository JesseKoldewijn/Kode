/**
 * IPC Bridge - Main Thread Wrapper for IPC Proxy Worker
 *
 * This module manages communication between the main thread and the IPC proxy worker.
 * It provides a Promise-based API that matches the Tauri invoke API, but routes all
 * calls through the worker for off-thread processing.
 */

import { invoke } from '@tauri-apps/api/core';

// Message types (matching worker types)
interface IPCRequest {
  id: string;
  command: string;
  params: Record<string, any>;
  sequence?: number;
}

interface IPCResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface MainThreadInvokeRequest {
  type: 'invoke';
  id: string;
  command: string;
  params: Record<string, any>;
}

interface MainThreadInvokeResponse {
  type: 'invoke-response';
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

interface WorkerRequest {
  type: 'ipc-request';
  request: IPCRequest;
}

interface WorkerResponse {
  type: 'ipc-response';
  response: IPCResponse;
}

class IPCBridge {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (data: any) => void;
      reject: (error: any) => void;
    }
  >();
  private initialized = false;
  private sequenceCounter = 1;

  /**
   * Initialize the worker
   */
  initialize() {
    if (this.initialized) return;

    try {
      // Create worker
      this.worker = new Worker(new URL('../workers/ipc-proxy.worker.ts', import.meta.url), {
        type: 'module',
      });

      // Handle messages from worker
      this.worker.addEventListener('message', (e: MessageEvent) => {
        const message = e.data;

        if (message.type === 'ipc-response') {
          this.handleWorkerResponse(message as WorkerResponse);
        } else if (message.type === 'invoke') {
          this.handleWorkerInvokeRequest(message as MainThreadInvokeRequest);
        }
      });

      // Handle worker errors
      this.worker.addEventListener('error', (e) => {
        console.error('[IPC Bridge] Worker error:', e);
      });

      this.initialized = true;
    } catch (err) {
      console.error('[IPC Bridge] Failed to initialize worker:', err);
      // Fall back to direct invoke if worker fails
      this.initialized = false;
    }
  }

  /**
   * Handle response from worker
   */
  private handleWorkerResponse(message: WorkerResponse) {
    const { response } = message;
    const pending = this.pendingRequests.get(response.id);

    if (!pending) return;

    if (response.success) {
      pending.resolve(response.data);
    } else {
      pending.reject(new Error(response.error || 'Unknown error'));
    }

    this.pendingRequests.delete(response.id);
  }

  /**
   * Handle invoke request from worker (relay to Tauri)
   */
  private async handleWorkerInvokeRequest(message: MainThreadInvokeRequest) {
    const { id, command, params } = message;

    try {
      const data = await invoke(command, params);

      const response: MainThreadInvokeResponse = {
        type: 'invoke-response',
        id,
        success: true,
        data,
      };

      this.worker?.postMessage(response);
    } catch (error) {
      const response: MainThreadInvokeResponse = {
        type: 'invoke-response',
        id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.worker?.postMessage(response);
    }
  }

  /**
   * Send IPC request through worker
   */
  async invokeViaWorker<T>(
    command: string,
    params: Record<string, any>,
    cancellable = false
  ): Promise<T> {
    // Fallback to direct invoke if worker not available
    if (!this.initialized || !this.worker) {
      return invoke<T>(command, params);
    }

    const id = `${command}-${Date.now()}-${Math.random()}`;
    const sequence = cancellable ? this.sequenceCounter++ : undefined;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const request: IPCRequest = {
        id,
        command,
        params,
        sequence,
      };

      const message: WorkerRequest = {
        type: 'ipc-request',
        request,
      };

      this.worker!.postMessage(message);
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const ipcBridge = new IPCBridge();

// Initialize on module load
if (typeof window !== 'undefined') {
  ipcBridge.initialize();
}

/**
 * Invoke command through IPC bridge
 */
export async function bridgedInvoke<T>(
  command: string,
  params: Record<string, any> = {},
  options: { cancellable?: boolean } = {}
): Promise<T> {
  return ipcBridge.invokeViaWorker<T>(command, params, options.cancellable);
}
