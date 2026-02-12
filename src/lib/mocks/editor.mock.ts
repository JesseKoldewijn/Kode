/**
 * Editor Mock Handlers
 *
 * Provides mock implementations for all editor-related Tauri commands
 * when running in browser mode. Maintains in-memory buffer state with
 * proper editing, selections, undo/redo, search, and basic highlighting.
 */

import { getMockFileContent } from './data/sample-project';
import type {
  LspSignatureHelp,
  LspSignatureInformation,
  LspParameterInformation,
} from '../editor-engine';

// ============================================================================
// Types (mirror the Rust backend types)
// ============================================================================

interface TextRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

interface EditOperation {
  range: TextRange;
  newText: string;
}

interface Selection {
  anchorLine: number;
  anchorCol: number;
  headLine: number;
  headCol: number;
}

interface BufferInfo {
  id: string;
  language: string;
  lineCount: number;
  charCount: number;
  version: number;
  isDirty: boolean;
  lineEnding: string;
}

interface EditResult {
  version: number;
  appliedRange: TextRange;
  newEnd: { line: number; col: number };
}

interface EditWithSelectionsResult {
  version: number;
  selections: {
    bufferId: string;
    selections: Selection[];
    primaryIndex: number;
  };
}

interface SelectionSet {
  bufferId: string;
  selections: Selection[];
  primaryIndex: number;
}

interface UndoRedoResult {
  success: boolean;
  version: number;
  content: string;
  selections: SelectionSet;
}

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface HighlightSpan {
  startCol: number;
  endCol: number;
  scope: string;
}

interface HighlightedLine {
  lineNumber: number;
  text: string;
  spans: HighlightSpan[];
}

interface ViewportHighlights {
  bufferId: string;
  version: number;
  lines: HighlightedLine[];
  totalLines: number;
}

interface SearchMatch {
  lineNumber: number;
  startCol: number;
  endCol: number;
  lineText: string;
  matchText: string;
}

interface FoldRange {
  startLine: number;
  endLine: number;
  kind: string;
}

interface DocumentSymbol {
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  children: DocumentSymbol[];
}

interface LspDiagnostic {
  range: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
  message: string;
  severity?: number;
  source?: string;
}

// ============================================================================
// Undo/Redo History
// ============================================================================

interface HistoryEntry {
  content: string;
  selections: Selection[];
}

interface BufferHistory {
  entries: HistoryEntry[];
  currentIndex: number;
}

// ============================================================================
// Buffer State
// ============================================================================

interface MockBuffer {
  id: string;
  content: string;
  language: string;
  version: number;
  isDirty: boolean;
  lineEnding: string;
  selections: Selection[];
  history: BufferHistory;
  savedContent: string; // content at last save
}

const buffers = new Map<string, MockBuffer>();

// ============================================================================
// Language Detection
// ============================================================================

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'css',
    less: 'css',
    html: 'html',
    htm: 'html',
    rs: 'rust',
    py: 'python',
    toml: 'toml',
    yaml: 'yaml',
    yml: 'yaml',
    go: 'go',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    hpp: 'cpp',
    sh: 'bash',
    bash: 'bash',
    ripple: 'ripple',
  };
  return langMap[ext] || 'plaintext';
}

// ============================================================================
// Helper: Apply Edit to Content String
// ============================================================================

function applyEdit(content: string, edit: EditOperation): string {
  const lines = content.split('\n');

  // Extract text before the edit range
  const beforeLines = lines.slice(0, edit.range.startLine);
  const startLineText = lines[edit.range.startLine] || '';
  const beforeText =
    beforeLines.join('\n') +
    (beforeLines.length > 0 ? '\n' : '') +
    startLineText.substring(0, edit.range.startCol);

  // Extract text after the edit range
  const endLineText = lines[edit.range.endLine] || '';
  const afterText = endLineText.substring(edit.range.endCol);
  const afterLines = lines.slice(edit.range.endLine + 1);
  const afterFullText = afterText + (afterLines.length > 0 ? '\n' + afterLines.join('\n') : '');

  // Combine: before + newText + after
  return beforeText + edit.newText + afterFullText;
}

function computeNewEnd(
  startLine: number,
  startCol: number,
  newText: string
): { line: number; col: number } {
  const newLines = newText.split('\n');
  if (newLines.length === 1) {
    return { line: startLine, col: startCol + newText.length };
  }
  return {
    line: startLine + newLines.length - 1,
    col: newLines[newLines.length - 1].length,
  };
}

// ============================================================================
// Helper: Record to History
// ============================================================================

function recordHistory(buffer: MockBuffer): void {
  // Truncate any redo entries
  buffer.history.entries = buffer.history.entries.slice(0, buffer.history.currentIndex + 1);

  // Add current state
  buffer.history.entries.push({
    content: buffer.content,
    selections: [...buffer.selections],
  });
  buffer.history.currentIndex = buffer.history.entries.length - 1;

  // Limit history size
  if (buffer.history.entries.length > 1000) {
    buffer.history.entries.shift();
    buffer.history.currentIndex--;
  }
}

// ============================================================================
// Basic Syntax Highlighting (keyword-based tokenizer)
// ============================================================================

// Language-specific keyword sets
const KEYWORDS: Record<string, Set<string>> = {
  typescript: new Set([
    'abstract',
    'as',
    'async',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'declare',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'from',
    'function',
    'get',
    'if',
    'implements',
    'import',
    'in',
    'instanceof',
    'interface',
    'is',
    'keyof',
    'let',
    'module',
    'namespace',
    'never',
    'new',
    'null',
    'number',
    'of',
    'package',
    'private',
    'protected',
    'public',
    'readonly',
    'return',
    'set',
    'static',
    'string',
    'super',
    'switch',
    'symbol',
    'this',
    'throw',
    'true',
    'try',
    'type',
    'typeof',
    'undefined',
    'unique',
    'unknown',
    'var',
    'void',
    'while',
    'with',
    'yield',
  ]),
  javascript: new Set([
    'async',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'from',
    'function',
    'get',
    'if',
    'import',
    'in',
    'instanceof',
    'let',
    'new',
    'null',
    'of',
    'return',
    'set',
    'static',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'undefined',
    'var',
    'void',
    'while',
    'with',
    'yield',
  ]),
  rust: new Set([
    'as',
    'async',
    'await',
    'break',
    'const',
    'continue',
    'crate',
    'dyn',
    'else',
    'enum',
    'extern',
    'false',
    'fn',
    'for',
    'if',
    'impl',
    'in',
    'let',
    'loop',
    'match',
    'mod',
    'move',
    'mut',
    'pub',
    'ref',
    'return',
    'self',
    'Self',
    'static',
    'struct',
    'super',
    'trait',
    'true',
    'type',
    'unsafe',
    'use',
    'where',
    'while',
  ]),
  python: new Set([
    'False',
    'None',
    'True',
    'and',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'class',
    'continue',
    'def',
    'del',
    'elif',
    'else',
    'except',
    'finally',
    'for',
    'from',
    'global',
    'if',
    'import',
    'in',
    'is',
    'lambda',
    'nonlocal',
    'not',
    'or',
    'pass',
    'raise',
    'return',
    'try',
    'while',
    'with',
    'yield',
  ]),
  json: new Set([]),
  css: new Set([]),
  html: new Set([]),
};

const TYPE_NAMES = new Set([
  'string',
  'number',
  'boolean',
  'void',
  'never',
  'any',
  'unknown',
  'object',
  'undefined',
  'null',
  'symbol',
  'bigint',
  'Array',
  'Map',
  'Set',
  'Promise',
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'ReturnType',
  'InstanceType',
  // Rust types
  'String',
  'Vec',
  'Option',
  'Result',
  'Box',
  'Rc',
  'Arc',
  'HashMap',
  'HashSet',
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'usize',
  'i8',
  'i16',
  'i32',
  'i64',
  'i128',
  'isize',
  'f32',
  'f64',
  'bool',
  'char',
  'str',
]);

function tokenizeLine(lineText: string, language: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  const keywords = KEYWORDS[language] || KEYWORDS['typescript'] || new Set();
  let i = 0;

  while (i < lineText.length) {
    // Skip whitespace
    if (/\s/.test(lineText[i])) {
      i++;
      continue;
    }

    // Line comment
    if (lineText[i] === '/' && lineText[i + 1] === '/') {
      spans.push({ startCol: i, endCol: lineText.length, scope: 'comment' });
      break;
    }

    // Hash comment (Python, YAML, etc.)
    if (
      lineText[i] === '#' &&
      (language === 'python' || language === 'yaml' || language === 'bash' || language === 'toml')
    ) {
      spans.push({ startCol: i, endCol: lineText.length, scope: 'comment' });
      break;
    }

    // Block comment start
    if (lineText[i] === '/' && lineText[i + 1] === '*') {
      const end = lineText.indexOf('*/', i + 2);
      if (end !== -1) {
        spans.push({ startCol: i, endCol: end + 2, scope: 'comment' });
        i = end + 2;
      } else {
        spans.push({ startCol: i, endCol: lineText.length, scope: 'comment' });
        break;
      }
      continue;
    }

    // String (double quote)
    if (lineText[i] === '"') {
      let j = i + 1;
      while (j < lineText.length && lineText[j] !== '"') {
        if (lineText[j] === '\\') j++; // skip escape
        j++;
      }
      spans.push({ startCol: i, endCol: Math.min(j + 1, lineText.length), scope: 'string' });
      i = Math.min(j + 1, lineText.length);
      continue;
    }

    // String (single quote)
    if (lineText[i] === "'") {
      let j = i + 1;
      while (j < lineText.length && lineText[j] !== "'") {
        if (lineText[j] === '\\') j++;
        j++;
      }
      spans.push({ startCol: i, endCol: Math.min(j + 1, lineText.length), scope: 'string' });
      i = Math.min(j + 1, lineText.length);
      continue;
    }

    // Template literal
    if (lineText[i] === '`') {
      let j = i + 1;
      while (j < lineText.length && lineText[j] !== '`') {
        if (lineText[j] === '\\') j++;
        j++;
      }
      spans.push({ startCol: i, endCol: Math.min(j + 1, lineText.length), scope: 'string' });
      i = Math.min(j + 1, lineText.length);
      continue;
    }

    // Number
    if (
      /[0-9]/.test(lineText[i]) ||
      (lineText[i] === '.' && i + 1 < lineText.length && /[0-9]/.test(lineText[i + 1]))
    ) {
      let j = i;
      if (lineText[j] === '0' && (lineText[j + 1] === 'x' || lineText[j + 1] === 'X')) {
        j += 2;
        while (j < lineText.length && /[0-9a-fA-F_]/.test(lineText[j])) j++;
      } else if (lineText[j] === '0' && (lineText[j + 1] === 'b' || lineText[j + 1] === 'B')) {
        j += 2;
        while (j < lineText.length && /[01_]/.test(lineText[j])) j++;
      } else {
        while (j < lineText.length && /[0-9._eE+\-]/.test(lineText[j])) j++;
      }
      spans.push({ startCol: i, endCol: j, scope: 'number' });
      i = j;
      continue;
    }

    // Identifier / keyword
    if (/[a-zA-Z_$@]/.test(lineText[i])) {
      let j = i;
      while (j < lineText.length && /[a-zA-Z0-9_$]/.test(lineText[j])) j++;
      const word = lineText.substring(i, j);

      if (keywords.has(word)) {
        spans.push({ startCol: i, endCol: j, scope: 'keyword' });
      } else if (TYPE_NAMES.has(word)) {
        spans.push({ startCol: i, endCol: j, scope: 'type' });
      } else if (j < lineText.length && lineText[j] === '(') {
        spans.push({ startCol: i, endCol: j, scope: 'function' });
      } else if (i > 0 && lineText[i - 1] === '.') {
        spans.push({ startCol: i, endCol: j, scope: 'property' });
      }
      // Plain identifiers don't get a span (default text color)
      i = j;
      continue;
    }

    // Operators
    if (/[+\-*/%=<>!&|^~?:]/.test(lineText[i])) {
      let j = i + 1;
      // Multi-char operators
      while (j < lineText.length && /[+\-*/%=<>!&|^~?:]/.test(lineText[j])) j++;
      spans.push({ startCol: i, endCol: j, scope: 'operator' });
      i = j;
      continue;
    }

    // Punctuation
    if (/[{}()\[\];,.]/.test(lineText[i])) {
      spans.push({ startCol: i, endCol: i + 1, scope: 'punctuation' });
      i++;
      continue;
    }

    // Everything else - skip
    i++;
  }

  return spans;
}

// ============================================================================
// Basic Fold Range Detection
// ============================================================================

function computeFoldRanges(content: string): FoldRange[] {
  const lines = content.split('\n');
  const ranges: FoldRange[] = [];
  const stack: { line: number; char: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '{' || ch === '[' || ch === '(') {
        stack.push({ line: i, char: ch });
      } else if (ch === '}' || ch === ']' || ch === ')') {
        const last = stack.pop();
        if (last && last.line < i) {
          ranges.push({
            startLine: last.line,
            endLine: i,
            kind: 'block',
          });
        }
      }
    }
  }

  // Sort by startLine
  ranges.sort((a, b) => a.startLine - b.startLine);
  return ranges;
}

// ============================================================================
// Command Handlers
// ============================================================================

function handleOpenBuffer(args: Record<string, unknown>): BufferInfo {
  const path = args.path as string;
  const content = getMockFileContent(path) ?? '';
  const language = detectLanguage(path);
  const lines = content.split('\n');

  const buffer: MockBuffer = {
    id: path,
    content,
    language,
    version: 1,
    isDirty: false,
    lineEnding: 'LF',
    selections: [{ anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 }],
    history: {
      entries: [
        { content, selections: [{ anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 }] },
      ],
      currentIndex: 0,
    },
    savedContent: content,
  };

  buffers.set(path, buffer);

  return {
    id: path,
    language,
    lineCount: lines.length,
    charCount: content.length,
    version: buffer.version,
    isDirty: false,
    lineEnding: 'LF',
  };
}

function handleCloseBuffer(args: Record<string, unknown>): void {
  const bufferId = args.bufferId as string;
  buffers.delete(bufferId);
}

function handleGetBufferInfo(args: Record<string, unknown>): BufferInfo {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer) {
    // Return a sensible default for buffers that aren't open yet
    const content = getMockFileContent(bufferId) ?? '';
    return {
      id: bufferId,
      language: detectLanguage(bufferId),
      lineCount: content.split('\n').length,
      charCount: content.length,
      version: 0,
      isDirty: false,
      lineEnding: 'LF',
    };
  }

  return {
    id: buffer.id,
    language: buffer.language,
    lineCount: buffer.content.split('\n').length,
    charCount: buffer.content.length,
    version: buffer.version,
    isDirty: buffer.isDirty,
    lineEnding: buffer.lineEnding,
  };
}

function handleEditBuffer(args: Record<string, unknown>): EditResult {
  const bufferId = args.bufferId as string;
  const edit = args.edit as EditOperation;
  const buffer = buffers.get(bufferId);

  if (!buffer) {
    return {
      version: 1,
      appliedRange: edit.range,
      newEnd: { line: edit.range.startLine, col: edit.range.startCol },
    };
  }

  // Apply edit
  buffer.content = applyEdit(buffer.content, edit);
  buffer.version++;
  buffer.isDirty = buffer.content !== buffer.savedContent;

  // Record state after edit for undo
  recordHistory(buffer);

  const newEnd = computeNewEnd(edit.range.startLine, edit.range.startCol, edit.newText);

  return {
    version: buffer.version,
    appliedRange: edit.range,
    newEnd,
  };
}

function handleEditBufferWithSelections(args: Record<string, unknown>): EditWithSelectionsResult {
  const bufferId = args.bufferId as string;
  const edit = args.edit as EditOperation;
  const selections = args.selections as Selection[];
  const buffer = buffers.get(bufferId);

  if (!buffer) {
    return {
      version: 1,
      selections: {
        bufferId,
        selections: selections || [{ anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 }],
        primaryIndex: 0,
      },
    };
  }

  // Apply edit
  buffer.content = applyEdit(buffer.content, edit);
  buffer.version++;
  buffer.isDirty = buffer.content !== buffer.savedContent;

  // Update selections
  if (selections) {
    buffer.selections = selections;
  }

  // Record state after edit for undo
  recordHistory(buffer);

  return {
    version: buffer.version,
    selections: {
      bufferId,
      selections: buffer.selections,
      primaryIndex: 0,
    },
  };
}

function handleSetSelections(args: Record<string, unknown>): SelectionSet {
  const bufferId = args.bufferId as string;
  const selections = args.selections as Selection[];
  const buffer = buffers.get(bufferId);

  if (buffer && selections) {
    buffer.selections = selections;
  }

  return {
    bufferId,
    selections: selections || [{ anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 }],
    primaryIndex: 0,
  };
}

function handleGetSelections(args: Record<string, unknown>): SelectionSet {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  return {
    bufferId,
    selections: buffer?.selections || [{ anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 }],
    primaryIndex: 0,
  };
}

function handleGetHighlights(args: Record<string, unknown>): ViewportHighlights {
  const bufferId = args.bufferId as string;
  const startLine = (args.startLine as number) || 0;
  const endLine = (args.endLine as number) || 100;
  const buffer = buffers.get(bufferId);

  if (!buffer) {
    // Even without buffer, try to get content for initial render
    const content = getMockFileContent(bufferId) ?? '';
    const allLines = content.split('\n');
    const language = detectLanguage(bufferId);
    const lines: HighlightedLine[] = [];

    for (let i = startLine; i < Math.min(endLine, allLines.length); i++) {
      lines.push({
        lineNumber: i,
        text: allLines[i],
        spans: tokenizeLine(allLines[i], language),
      });
    }

    return {
      bufferId,
      version: 0,
      lines,
      totalLines: allLines.length,
    };
  }

  const allLines = buffer.content.split('\n');
  const lines: HighlightedLine[] = [];

  for (let i = startLine; i < Math.min(endLine, allLines.length); i++) {
    lines.push({
      lineNumber: i,
      text: allLines[i],
      spans: tokenizeLine(allLines[i], buffer.language),
    });
  }

  return {
    bufferId,
    version: buffer.version,
    lines,
    totalLines: allLines.length,
  };
}

function handleSearchBuffer(args: Record<string, unknown>): SearchMatch[] {
  const bufferId = args.bufferId as string;
  const query = args.query as string;
  const isRegex = args.isRegex as boolean;
  const caseSensitive = args.caseSensitive as boolean;
  const buffer = buffers.get(bufferId);

  if (!buffer || !query) return [];

  const lines = buffer.content.split('\n');
  const matches: SearchMatch[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    let searchText = lineText;
    let searchQuery = query;

    if (!caseSensitive) {
      searchText = lineText.toLowerCase();
      searchQuery = query.toLowerCase();
    }

    if (isRegex) {
      try {
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(query, flags);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(lineText)) !== null) {
          matches.push({
            lineNumber: i,
            startCol: match.index,
            endCol: match.index + match[0].length,
            lineText,
            matchText: match[0],
          });
          if (match[0].length === 0) break; // Prevent infinite loop
        }
      } catch {
        // Invalid regex - fall through
      }
    } else {
      let startIdx = 0;
      while (true) {
        const idx = searchText.indexOf(searchQuery, startIdx);
        if (idx === -1) break;
        matches.push({
          lineNumber: i,
          startCol: idx,
          endCol: idx + query.length,
          lineText,
          matchText: lineText.substring(idx, idx + query.length),
        });
        startIdx = idx + 1;
      }
    }
  }

  return matches;
}

function handleGetSymbols(args: Record<string, unknown>): DocumentSymbol[] {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer) return [];

  // Basic symbol extraction using regex patterns
  const lines = buffer.content.split('\n');
  const symbols: DocumentSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Function declarations
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        kind: 'Function',
        startLine: i,
        endLine: i,
        startCol: line.indexOf(funcMatch[1]),
        endCol: line.indexOf(funcMatch[1]) + funcMatch[1].length,
        children: [],
      });
    }

    // Class declarations
    const classMatch = line.match(/(?:export\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'Class',
        startLine: i,
        endLine: i,
        startCol: line.indexOf(classMatch[1]),
        endCol: line.indexOf(classMatch[1]) + classMatch[1].length,
        children: [],
      });
    }

    // Interface declarations
    const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
    if (interfaceMatch) {
      symbols.push({
        name: interfaceMatch[1],
        kind: 'Interface',
        startLine: i,
        endLine: i,
        startCol: line.indexOf(interfaceMatch[1]),
        endCol: line.indexOf(interfaceMatch[1]) + interfaceMatch[1].length,
        children: [],
      });
    }

    // Const/let/var declarations
    const varMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)/);
    if (varMatch && !funcMatch) {
      symbols.push({
        name: varMatch[1],
        kind: 'Variable',
        startLine: i,
        endLine: i,
        startCol: line.indexOf(varMatch[1]),
        endCol: line.indexOf(varMatch[1]) + varMatch[1].length,
        children: [],
      });
    }
  }

  return symbols;
}

function handleGetFoldRanges(args: Record<string, unknown>): FoldRange[] {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer) return [];

  return computeFoldRanges(buffer.content);
}

function handleUndo(args: Record<string, unknown>): UndoRedoResult {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer || buffer.history.currentIndex <= 0) {
    return {
      success: false,
      version: buffer?.version ?? 0,
      content: buffer?.content ?? '',
      selections: {
        bufferId,
        selections: buffer?.selections || [
          { anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 },
        ],
        primaryIndex: 0,
      },
    };
  }

  buffer.history.currentIndex--;
  const entry = buffer.history.entries[buffer.history.currentIndex];
  buffer.content = entry.content;
  buffer.selections = [...entry.selections];
  buffer.version++;
  buffer.isDirty = buffer.content !== buffer.savedContent;

  return {
    success: true,
    version: buffer.version,
    content: buffer.content,
    selections: {
      bufferId,
      selections: buffer.selections,
      primaryIndex: 0,
    },
  };
}

function handleRedo(args: Record<string, unknown>): UndoRedoResult {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer || buffer.history.currentIndex >= buffer.history.entries.length - 1) {
    return {
      success: false,
      version: buffer?.version ?? 0,
      content: buffer?.content ?? '',
      selections: {
        bufferId,
        selections: buffer?.selections || [
          { anchorLine: 0, anchorCol: 0, headLine: 0, headCol: 0 },
        ],
        primaryIndex: 0,
      },
    };
  }

  buffer.history.currentIndex++;
  const entry = buffer.history.entries[buffer.history.currentIndex];
  buffer.content = entry.content;
  buffer.selections = [...entry.selections];
  buffer.version++;
  buffer.isDirty = buffer.content !== buffer.savedContent;

  return {
    success: true,
    version: buffer.version,
    content: buffer.content,
    selections: {
      bufferId,
      selections: buffer.selections,
      primaryIndex: 0,
    },
  };
}

function handleGetHistoryState(args: Record<string, unknown>): HistoryState {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer) {
    return { canUndo: false, canRedo: false };
  }

  return {
    canUndo: buffer.history.currentIndex > 0,
    canRedo: buffer.history.currentIndex < buffer.history.entries.length - 1,
  };
}

function handleSaveBuffer(args: Record<string, unknown>): { version: number; content: string } {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer) {
    return { version: 0, content: '' };
  }

  buffer.savedContent = buffer.content;
  buffer.isDirty = false;

  return {
    version: buffer.version,
    content: buffer.content,
  };
}

// ============================================================================
// LSP Mock Handlers
// ============================================================================

function handleLspHasSession(args: Record<string, unknown>): boolean {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);
  if (!buffer) return false;

  // Return true for languages that would have an LSP server
  return ['typescript', 'javascript', 'tsx', 'jsx', 'rust', 'python'].includes(buffer.language);
}

function handleLspGetDiagnostics(_args: Record<string, unknown>): LspDiagnostic[] {
  // Return empty diagnostics in mock mode
  return [];
}

function handleLspHover(args: Record<string, unknown>): { contents: string } | null {
  const bufferId = args.bufferId as string;
  const line = args.line as number;
  const character = args.character as number;
  const buffer = buffers.get(bufferId);

  if (!buffer) return null;

  const lines = buffer.content.split('\n');
  if (line >= lines.length) return null;

  const lineText = lines[line];

  // Find the word under cursor
  let start = character;
  let end = character;
  while (start > 0 && /[a-zA-Z0-9_$]/.test(lineText[start - 1])) start--;
  while (end < lineText.length && /[a-zA-Z0-9_$]/.test(lineText[end])) end++;

  const word = lineText.substring(start, end);
  if (!word) return null;

  // Return type information for common patterns
  if (
    ['console', 'window', 'document', 'Math', 'JSON', 'Array', 'Object', 'Promise'].includes(word)
  ) {
    return { contents: `(builtin) ${word}` };
  }

  return { contents: `${word}: any` };
}

function handleLspCompletion(
  args: Record<string, unknown>
): Array<{ label: string; kind?: number; detail?: string; insertText?: string }> | null {
  const bufferId = args.bufferId as string;
  const buffer = buffers.get(bufferId);

  if (!buffer) return null;

  // Return some basic completions based on language
  if (buffer.language === 'typescript' || buffer.language === 'javascript') {
    return [
      { label: 'console', kind: 6, detail: 'Console API' },
      { label: 'document', kind: 6, detail: 'Document API' },
      { label: 'window', kind: 6, detail: 'Window API' },
      { label: 'function', kind: 14, detail: 'Keyword' },
      { label: 'const', kind: 14, detail: 'Keyword' },
      { label: 'let', kind: 14, detail: 'Keyword' },
      { label: 'import', kind: 14, detail: 'Keyword' },
      { label: 'export', kind: 14, detail: 'Keyword' },
      { label: 'return', kind: 14, detail: 'Keyword' },
      { label: 'if', kind: 14, detail: 'Keyword' },
    ];
  }

  return null;
}

function handleLspGotoDefinition(_args: Record<string, unknown>): null {
  // No real goto definition in mock mode
  return null;
}

// Mock signature database with common functions
const SIGNATURE_DATABASE: Record<string, LspSignatureInformation[]> = {
  'console.log': [
    {
      label: 'log(...data: any[]): void',
      documentation: 'Outputs a message to the console',
      parameters: [{ label: '...data: any[]', documentation: 'Data to log' }],
    },
  ],
  log: [
    {
      label: 'log(...data: any[]): void',
      documentation: 'Outputs a message to the console',
      parameters: [{ label: '...data: any[]', documentation: 'Data to log' }],
    },
  ],
  'console.error': [
    {
      label: 'error(...data: any[]): void',
      documentation: 'Outputs an error message to the console',
      parameters: [{ label: '...data: any[]', documentation: 'Error data' }],
    },
  ],
  'console.warn': [
    {
      label: 'warn(...data: any[]): void',
      documentation: 'Outputs a warning message to the console',
      parameters: [{ label: '...data: any[]', documentation: 'Warning data' }],
    },
  ],
  setTimeout: [
    {
      label: 'setTimeout(callback: () => void, ms?: number): number',
      documentation: 'Calls a function after a delay',
      parameters: [
        { label: 'callback: () => void', documentation: 'Function to call' },
        { label: 'ms?: number', documentation: 'Delay in milliseconds' },
      ],
    },
    {
      label: 'setTimeout(code: string, ms?: number): number',
      documentation: 'Evaluates code after a delay (not recommended)',
      parameters: [
        { label: 'code: string', documentation: 'Code to evaluate' },
        { label: 'ms?: number', documentation: 'Delay in milliseconds' },
      ],
    },
  ],
  setInterval: [
    {
      label: 'setInterval(callback: () => void, ms?: number): number',
      documentation: 'Calls a function repeatedly at intervals',
      parameters: [
        { label: 'callback: () => void', documentation: 'Function to call' },
        { label: 'ms?: number', documentation: 'Interval in milliseconds' },
      ],
    },
  ],
  'Math.max': [
    {
      label: 'max(...values: number[]): number',
      documentation: 'Returns the largest of the given numbers',
      parameters: [{ label: '...values: number[]', documentation: 'Numbers to compare' }],
    },
  ],
  'Math.min': [
    {
      label: 'min(...values: number[]): number',
      documentation: 'Returns the smallest of the given numbers',
      parameters: [{ label: '...values: number[]', documentation: 'Numbers to compare' }],
    },
  ],
  'Math.pow': [
    {
      label: 'pow(base: number, exponent: number): number',
      documentation: 'Returns base raised to the exponent power',
      parameters: [
        { label: 'base: number', documentation: 'The base number' },
        { label: 'exponent: number', documentation: 'The exponent' },
      ],
    },
  ],
  fetch: [
    {
      label: 'fetch(url: string, init?: RequestInit): Promise<Response>',
      documentation: 'Starts the process of fetching a resource from the network',
      parameters: [
        { label: 'url: string', documentation: 'URL of the resource' },
        { label: 'init?: RequestInit', documentation: 'Optional request configuration' },
      ],
    },
  ],
  'JSON.parse': [
    {
      label: 'parse(text: string, reviver?: (key: any, value: any) => any): any',
      documentation: 'Parses a JSON string',
      parameters: [
        { label: 'text: string', documentation: 'JSON string to parse' },
        {
          label: 'reviver?: (key: any, value: any) => any',
          documentation: 'Optional transformation function',
        },
      ],
    },
  ],
  'JSON.stringify': [
    {
      label: 'stringify(value: any, replacer?: any, space?: string | number): string',
      documentation: 'Converts a value to a JSON string',
      parameters: [
        { label: 'value: any', documentation: 'Value to stringify' },
        { label: 'replacer?: any', documentation: 'Optional replacer function or array' },
        { label: 'space?: string | number', documentation: 'Indentation for pretty-printing' },
      ],
    },
  ],
  'Array.map': [
    {
      label: 'map<U>(callback: (value: T, index: number, array: T[]) => U): U[]',
      documentation: 'Creates a new array with results of calling a function for every element',
      parameters: [
        {
          label: 'callback: (value: T, index: number, array: T[]) => U',
          documentation: 'Function to transform each element',
        },
      ],
    },
  ],
  'Array.filter': [
    {
      label: 'filter(predicate: (value: T, index: number, array: T[]) => boolean): T[]',
      documentation: 'Creates a new array with elements that pass the test',
      parameters: [
        {
          label: 'predicate: (value: T, index: number, array: T[]) => boolean',
          documentation: 'Function to test each element',
        },
      ],
    },
  ],
  'Array.reduce': [
    {
      label:
        'reduce<U>(callback: (acc: U, value: T, index: number, array: T[]) => U, initial: U): U',
      documentation: 'Reduces array to a single value',
      parameters: [
        {
          label: 'callback: (acc: U, value: T, index: number, array: T[]) => U',
          documentation: 'Reducer function',
        },
        { label: 'initial: U', documentation: 'Initial accumulator value' },
      ],
    },
  ],
  'Promise.all': [
    {
      label: 'all<T>(promises: Promise<T>[]): Promise<T[]>',
      documentation: 'Waits for all promises to resolve',
      parameters: [{ label: 'promises: Promise<T>[]', documentation: 'Array of promises' }],
    },
  ],
  'Promise.race': [
    {
      label: 'race<T>(promises: Promise<T>[]): Promise<T>',
      documentation: 'Returns the result of the first promise to settle',
      parameters: [{ label: 'promises: Promise<T>[]', documentation: 'Array of promises' }],
    },
  ],
};

function handleLspSignatureHelp(args: Record<string, unknown>): LspSignatureHelp | null {
  const bufferId = args.bufferId as string;
  const line = args.line as number;
  const character = args.character as number;
  const buffer = buffers.get(bufferId);

  if (!buffer) return null;

  // Only support TypeScript/JavaScript
  if (!['typescript', 'javascript', 'tsx', 'jsx'].includes(buffer.language)) {
    return null;
  }

  const lines = buffer.content.split('\n');
  if (line >= lines.length) return null;

  const lineText = lines[line];
  const beforeCursor = lineText.substring(0, character);

  // Match function call pattern: functionName( or object.method(
  // Capture function name and arguments before cursor
  const match = beforeCursor.match(/(\w+(?:\.\w+)?)\s*\(([^()]*)$/);
  if (!match) return null;

  const funcName = match[1];
  const argsText = match[2];

  // Count commas to determine active parameter
  // Need to be careful not to count commas inside nested parens/brackets
  let depth = 0;
  let commaCount = 0;
  for (const char of argsText) {
    if (char === '(' || char === '[' || char === '{') {
      depth++;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
    } else if (char === ',' && depth === 0) {
      commaCount++;
    }
  }

  // Look up signature in database
  const signatures = SIGNATURE_DATABASE[funcName];
  if (!signatures) return null;

  // Choose active signature (prefer first matching signature)
  const activeSignature = 0;
  const activeParam = Math.min(
    commaCount,
    (signatures[activeSignature].parameters?.length ?? 1) - 1
  );

  return {
    signatures,
    activeSignature,
    activeParameter: activeParam,
  };
}

function handleLspCodeAction(_args: Record<string, unknown>): null {
  return null;
}

function handleLspInlayHints(_args: Record<string, unknown>): null {
  return null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Handle editor IPC commands
 * Returns undefined if the command is not handled (allowing fallback)
 */
export function handleEditorCommand(cmd: string, args: Record<string, unknown>): unknown {
  switch (cmd) {
    // Buffer management
    case 'open_buffer':
      return handleOpenBuffer(args);
    case 'close_buffer':
      return handleCloseBuffer(args);
    case 'get_buffer_info':
      return handleGetBufferInfo(args);

    // Editing
    case 'edit_buffer':
      return handleEditBuffer(args);
    case 'edit_buffer_with_selections':
      return handleEditBufferWithSelections(args);

    // Selections
    case 'set_selections':
      return handleSetSelections(args);
    case 'get_selections':
      return handleGetSelections(args);

    // Highlighting
    case 'get_highlights':
      return handleGetHighlights(args);

    // Search
    case 'search_buffer':
      return handleSearchBuffer(args);

    // Symbols
    case 'get_symbols':
      return handleGetSymbols(args);

    // Folding
    case 'get_fold_ranges':
      return handleGetFoldRanges(args);

    // Undo/Redo
    case 'undo_buffer':
      return handleUndo(args);
    case 'redo_buffer':
      return handleRedo(args);
    case 'get_history_state':
      return handleGetHistoryState(args);

    // Save
    case 'save_buffer':
      return handleSaveBuffer(args);

    // LSP
    case 'lsp_has_session':
      return handleLspHasSession(args);
    case 'lsp_get_diagnostics':
      return handleLspGetDiagnostics(args);
    case 'lsp_hover':
      return handleLspHover(args);
    case 'lsp_completion':
      return handleLspCompletion(args);
    case 'lsp_goto_definition':
      return handleLspGotoDefinition(args);
    case 'lsp_signature_help':
      return handleLspSignatureHelp(args);
    case 'lsp_code_action':
      return handleLspCodeAction(args);
    case 'lsp_inlay_hints':
      return handleLspInlayHints(args);

    default:
      return undefined; // Not handled
  }
}

/**
 * Check if a command is an editor command
 */
export function isEditorCommand(cmd: string): boolean {
  return [
    'open_buffer',
    'close_buffer',
    'get_buffer_info',
    'edit_buffer',
    'edit_buffer_with_selections',
    'set_selections',
    'get_selections',
    'get_highlights',
    'search_buffer',
    'get_symbols',
    'get_fold_ranges',
    'undo_buffer',
    'redo_buffer',
    'get_history_state',
    'save_buffer',
    'lsp_has_session',
    'lsp_get_diagnostics',
    'lsp_hover',
    'lsp_completion',
    'lsp_goto_definition',
    'lsp_signature_help',
    'lsp_code_action',
    'lsp_inlay_hints',
  ].includes(cmd);
}

/**
 * Reset all editor mock state
 */
export function resetEditorMocks(): void {
  buffers.clear();
}

/**
 * Get a buffer for testing purposes
 */
export function getMockBuffer(bufferId: string): MockBuffer | undefined {
  return buffers.get(bufferId);
}
