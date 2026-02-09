import { invoke } from '@tauri-apps/api/core';

export interface BufferInfo {
  id: string;
  language: string;
  lineCount: number;
  charCount: number;
  version: number;
  isDirty: boolean;
  lineEnding: string;
}

export interface HighlightSpan {
  startCol: number;
  endCol: number;
  scope: string;
}

export interface HighlightedLine {
  lineNumber: number;
  text: string;
  spans: HighlightSpan[];
}

export interface ViewportHighlights {
  bufferId: string;
  version: number;
  lines: HighlightedLine[];
  totalLines: number;
}

export interface TextRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface EditOperation {
  range: TextRange;
  newText: string;
}

export interface Position {
  line: number;
  col: number;
}

export interface EditResult {
  version: number;
  appliedRange: TextRange;
  newEnd: Position;
}

export interface Selection {
  anchorLine: number;
  anchorCol: number;
  headLine: number;
  headCol: number;
}

export interface SelectionSet {
  bufferId: string;
  selections: Selection[];
  primaryIndex: number;
}

export interface UndoRedoResult {
  success: boolean;
  version: number;
  content: string;
  selections: SelectionSet;
}

export interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

export const editorEngine = {
  async openBuffer(path: string): Promise<BufferInfo> {
    console.log('[EditorEngine] openBuffer START:', path);
    try {
      const result = await invoke<BufferInfo>('open_buffer', { path });
      console.log('[EditorEngine] openBuffer SUCCESS:', result);
      return result;
    } catch (error) {
      console.error('[EditorEngine] openBuffer ERROR:', error);
      throw error;
    }
  },

  async closeBuffer(bufferId: string): Promise<void> {
    return await invoke('close_buffer', { bufferId });
  },

  async getHighlights(
    bufferId: string,
    startLine: number,
    endLine: number
  ): Promise<ViewportHighlights> {
    return await invoke('get_highlights', { bufferId, startLine, endLine });
  },

  async editBuffer(bufferId: string, edit: EditOperation): Promise<EditResult> {
    return await invoke('edit_buffer', { bufferId, edit });
  },

  async setSelections(bufferId: string, selections: Selection[]): Promise<SelectionSet> {
    return await invoke('set_selections', { bufferId, selections });
  },

  async getSelections(bufferId: string): Promise<SelectionSet> {
    return await invoke('get_selections', { bufferId });
  },

  async undo(bufferId: string): Promise<UndoRedoResult> {
    return await invoke('undo_buffer', { bufferId });
  },

  async redo(bufferId: string): Promise<UndoRedoResult> {
    return await invoke('redo_buffer', { bufferId });
  },

  async getHistoryState(bufferId: string): Promise<HistoryState> {
    return await invoke('get_history_state', { bufferId });
  },
};
