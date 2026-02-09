/**
 * IPC Proxy Worker
 *
 * Handles all Tauri IPC communication off the main thread with:
 * - Request batching (combines edit + selection updates)
 * - Request deduplication (only latest getHighlights per buffer)
 * - Request cancellation via sequence numbers
 *
 * Architecture:
 * - Worker receives requests from main thread
 * - Relays them back to main thread for actual invoke() call
 * - Main thread sends back responses which worker forwards to callers
 *
 * This design works around the limitation that Workers don't have
 * access to window.__TAURI_INTERNALS__.
 */

// Message types
interface IPCRequest {
  id: string;
  command: string;
  params: Record<string, any>;
  sequence?: number; // For cancellable operations
}

interface IPCResponse {
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

// Pending requests awaiting responses
const pendingRequests = new Map<
  string,
  {
    resolve: (data: any) => void;
    reject: (error: any) => void;
    command: string;
    sequence?: number;
  }
>();

// Batching state
let editBatchTimer: number | null = null;
const BATCH_DELAY_MS = 5; // Very short delay to batch rapid edits
let pendingEdit: { bufferId: string; edit: any; selections: any; requestId: string } | null = null;

// Deduplication state for getHighlights
const highlightSequences = new Map<string, number>();
let nextSequence = 1;

/**
 * Request IPC invoke on main thread
 */
function invokeOnMainThread(command: string, params: Record<string, any>): Promise<any> {
  const id = `${command}-${Date.now()}-${Math.random()}`;

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, command });

    const message: MainThreadInvokeRequest = {
      type: 'invoke',
      id,
      command,
      params,
    };

    self.postMessage(message);
  });
}

/**
 * Handle batched edit + selection update
 */
function flushEditBatch() {
  if (!pendingEdit) return;

  const { bufferId, edit, selections, requestId } = pendingEdit;
  pendingEdit = null;
  editBatchTimer = null;

  // Use combined command
  invokeOnMainThread('edit_buffer_with_selections', {
    bufferId,
    edit,
    selections,
  })
    .then((data) => {
      const response: IPCResponse = {
        id: requestId,
        success: true,
        data,
      };
      self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
    })
    .catch((error) => {
      const response: IPCResponse = {
        id: requestId,
        success: false,
        error: error.toString(),
      };
      self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
    });
}

/**
 * Handle incoming IPC request
 */
function handleIPCRequest(request: IPCRequest) {
  const { id, command, params, sequence } = request;

  // Special handling for edit_buffer_with_selections (batching)
  if (command === 'edit_buffer_with_selections') {
    // Cancel previous batch if exists
    if (editBatchTimer !== null) {
      clearTimeout(editBatchTimer);
    }

    // Store this edit
    pendingEdit = {
      bufferId: params.bufferId as string,
      edit: params.edit,
      selections: params.selections,
      requestId: id,
    };

    // Flush after short delay (allows batching rapid keystrokes)
    editBatchTimer = setTimeout(flushEditBatch, BATCH_DELAY_MS) as unknown as number;
    return;
  }

  // Special handling for getHighlights (deduplication)
  if (command === 'get_highlights') {
    const bufferId = params.bufferId as string;

    // Assign sequence number
    const seq = sequence || nextSequence++;

    // Check if this is stale (newer request for same buffer exists)
    const latestSeq = highlightSequences.get(bufferId);
    if (latestSeq !== undefined && seq < latestSeq) {
      // Stale request, ignore
      const response: IPCResponse = {
        id,
        success: false,
        error: 'Cancelled (stale request)',
      };
      self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
      return;
    }

    // Update latest sequence for this buffer
    highlightSequences.set(bufferId, seq);

    // Store sequence in pending request for cancellation check
    pendingRequests.set(id, {
      resolve: (data) => {
        // Check if still latest when response arrives
        if (highlightSequences.get(bufferId) === seq) {
          const response: IPCResponse = {
            id,
            success: true,
            data,
          };
          self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
        } else {
          // Was superseded
          const response: IPCResponse = {
            id,
            success: false,
            error: 'Cancelled (superseded)',
          };
          self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
        }
        pendingRequests.delete(id);
      },
      reject: (error) => {
        const response: IPCResponse = {
          id,
          success: false,
          error: error.toString(),
        };
        self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
        pendingRequests.delete(id);
      },
      command,
      sequence: seq,
    });

    invokeOnMainThread(command, params)
      .then((data) => pendingRequests.get(id)?.resolve(data))
      .catch((error) => pendingRequests.get(id)?.reject(error));

    return;
  }

  // All other commands: direct invoke
  invokeOnMainThread(command, params)
    .then((data) => {
      const response: IPCResponse = {
        id,
        success: true,
        data,
      };
      self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
    })
    .catch((error) => {
      const response: IPCResponse = {
        id,
        success: false,
        error: error.toString(),
      };
      self.postMessage({ type: 'ipc-response', response } as WorkerResponse);
    });
}

/**
 * Handle response from main thread's invoke call
 */
function handleInvokeResponse(msg: MainThreadInvokeResponse) {
  const pending = pendingRequests.get(msg.id);
  if (!pending) return;

  if (msg.success) {
    pending.resolve(msg.data);
  } else {
    pending.reject(new Error(msg.error || 'Unknown error'));
  }

  pendingRequests.delete(msg.id);
}

// Main worker message handler
self.addEventListener('message', (e: MessageEvent) => {
  const message = e.data;

  if (message.type === 'ipc-request') {
    const workerReq = message as WorkerRequest;
    handleIPCRequest(workerReq.request);
  } else if (message.type === 'invoke-response') {
    const invokeRes = message as MainThreadInvokeResponse;
    handleInvokeResponse(invokeRes);
  }
});

// Export empty object for TypeScript
export {};
