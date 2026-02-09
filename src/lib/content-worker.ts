/**
 * Content Worker Manager
 *
 * Provides a typed interface to communicate with the content processing worker.
 */

interface SetContentMessage {
  type: 'set-content';
  id: string;
  content: string;
}

interface ApplyEditMessage {
  type: 'apply-edit';
  id: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  newText: string;
}

interface GetLinesMessage {
  type: 'get-lines';
  id: string;
  startLine: number;
  endLine: number;
}

interface ClearMessage {
  type: 'clear';
  id: string;
}

type WorkerMessage = SetContentMessage | ApplyEditMessage | GetLinesMessage | ClearMessage;

interface LinesResponse {
  type: 'lines-response';
  id: string;
  lines: string[];
  totalLines: number;
  changedIndices?: number[];
}

interface ErrorResponse {
  type: 'error';
  id: string;
  error: string;
}

type WorkerResponse = LinesResponse | ErrorResponse;

class ContentWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (response: LinesResponse) => void;
      reject: (error: Error) => void;
    }
  >();
  private requestCounter = 0;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      this.worker = new Worker(new URL('../workers/content.worker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
        this.handleResponse(e.data);
      });

      this.worker.addEventListener('error', (e) => {
        console.error('[Content Worker] Error:', e);
      });
    } catch (err) {
      console.error('[Content Worker] Failed to initialize:', err);
    }
  }

  private handleResponse(response: WorkerResponse) {
    if (response.type === 'lines-response') {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        pending.resolve(response);
        this.pendingRequests.delete(response.id);
      }
    } else if (response.type === 'error') {
      const pending = this.pendingRequests.get(response.id);
      if (pending) {
        pending.reject(new Error(response.error));
        this.pendingRequests.delete(response.id);
      }
    }
  }

  private sendMessage<T extends WorkerMessage>(message: T): Promise<LinesResponse> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not initialized'));
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });
      this.worker!.postMessage(message);
    });
  }

  async setContent(content: string): Promise<LinesResponse> {
    const id = `set-${this.requestCounter++}`;
    return this.sendMessage<SetContentMessage>({
      type: 'set-content',
      id,
      content,
    });
  }

  async applyEdit(
    startLine: number,
    startCol: number,
    endLine: number,
    endCol: number,
    newText: string
  ): Promise<LinesResponse> {
    const id = `edit-${this.requestCounter++}`;
    return this.sendMessage<ApplyEditMessage>({
      type: 'apply-edit',
      id,
      startLine,
      startCol,
      endLine,
      endCol,
      newText,
    });
  }

  async getLines(startLine: number, endLine: number): Promise<LinesResponse> {
    const id = `get-${this.requestCounter++}`;
    return this.sendMessage<GetLinesMessage>({
      type: 'get-lines',
      id,
      startLine,
      endLine,
    });
  }

  async clear(): Promise<LinesResponse> {
    const id = `clear-${this.requestCounter++}`;
    return this.sendMessage<ClearMessage>({
      type: 'clear',
      id,
    });
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

// Export singleton (but allow per-component instances if needed)
export const contentWorker = new ContentWorkerManager();

// Export class for custom instances
export { ContentWorkerManager };
