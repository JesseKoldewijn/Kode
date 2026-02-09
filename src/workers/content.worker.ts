/**
 * Content Processing Worker
 *
 * Manages line-based content representation off the main thread:
 * - Splits content into lines (no more main-thread .split('\n'))
 * - Applies incremental edits to line array
 * - Computes which line indices changed
 * - Handles full content replacement (undo/redo)
 */

// Message types
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
  changedIndices?: number[]; // For incremental updates
}

interface ErrorResponse {
  type: 'error';
  id: string;
  error: string;
}

type WorkerResponse = LinesResponse | ErrorResponse;

// State
let lines: string[] = [];

/**
 * Set full content (split into lines)
 */
function setContent(content: string): void {
  lines = content.split('\n');
}

/**
 * Apply an incremental edit to the line array
 * Returns indices of lines that were modified
 */
function applyEdit(
  startLine: number,
  startCol: number,
  endLine: number,
  endCol: number,
  newText: string
): number[] {
  const changedIndices: number[] = [];

  // Extract the text that's being replaced
  const startLineText = lines[startLine] || '';
  const endLineText = lines[endLine] || '';

  // Build the new content by combining:
  // - Start of first line (before startCol)
  // - New text
  // - End of last line (after endCol)
  const prefix = startLineText.substring(0, startCol);
  const suffix = endLineText.substring(endCol);
  const newContent = prefix + newText + suffix;

  // Split new content into lines
  const newLines = newContent.split('\n');

  // Calculate how many lines to remove
  const removeCount = endLine - startLine + 1;

  // Replace lines
  lines.splice(startLine, removeCount, ...newLines);

  // Track changed indices
  for (let i = startLine; i < startLine + newLines.length; i++) {
    changedIndices.push(i);
  }

  return changedIndices;
}

/**
 * Get lines in a specific range
 */
function getLines(startLine: number, endLine: number): string[] {
  const result: string[] = [];
  for (let i = startLine; i < Math.min(endLine, lines.length); i++) {
    result.push(lines[i] || '');
  }
  return result;
}

/**
 * Clear all content
 */
function clear(): void {
  lines = [];
}

// Message handler
self.addEventListener('message', (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;

  try {
    switch (message.type) {
      case 'set-content': {
        setContent(message.content);
        const response: LinesResponse = {
          type: 'lines-response',
          id: message.id,
          lines: lines.slice(), // Return all lines
          totalLines: lines.length,
        };
        self.postMessage(response);
        break;
      }

      case 'apply-edit': {
        const changedIndices = applyEdit(
          message.startLine,
          message.startCol,
          message.endLine,
          message.endCol,
          message.newText
        );

        const response: LinesResponse = {
          type: 'lines-response',
          id: message.id,
          lines: lines.slice(), // Return all lines
          totalLines: lines.length,
          changedIndices,
        };
        self.postMessage(response);
        break;
      }

      case 'get-lines': {
        const requestedLines = getLines(message.startLine, message.endLine);
        const response: LinesResponse = {
          type: 'lines-response',
          id: message.id,
          lines: requestedLines,
          totalLines: lines.length,
        };
        self.postMessage(response);
        break;
      }

      case 'clear': {
        clear();
        const response: LinesResponse = {
          type: 'lines-response',
          id: message.id,
          lines: [],
          totalLines: 0,
        };
        self.postMessage(response);
        break;
      }
    }
  } catch (error) {
    const errorResponse: ErrorResponse = {
      type: 'error',
      id: message.id,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(errorResponse);
  }
});

// Export empty object for TypeScript
export {};
