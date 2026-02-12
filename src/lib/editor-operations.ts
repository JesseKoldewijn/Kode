import type { EditOperation, Selection } from './editor-engine';

// ============================================================================
// Language Comment Syntax Map
// ============================================================================

interface CommentSyntax {
  line?: string;
  block?: { start: string; end: string };
}

const COMMENT_SYNTAX: Record<string, CommentSyntax> = {
  javascript: { line: '//', block: { start: '/*', end: '*/' } },
  typescript: { line: '//', block: { start: '/*', end: '*/' } },
  rust: { line: '//', block: { start: '/*', end: '*/' } },
  python: { line: '#', block: { start: "'''", end: "'''" } },
  css: { block: { start: '/*', end: '*/' } },
  html: { block: { start: '<!--', end: '-->' } },
  json: {}, // JSON does not support comments
  markdown: { block: { start: '<!--', end: '-->' } },
  yaml: { line: '#' },
  toml: { line: '#' },
  go: { line: '//', block: { start: '/*', end: '*/' } },
  java: { line: '//', block: { start: '/*', end: '*/' } },
  c: { line: '//', block: { start: '/*', end: '*/' } },
  cpp: { line: '//', block: { start: '/*', end: '*/' } },
  csharp: { line: '//', block: { start: '/*', end: '*/' } },
  php: { line: '//', block: { start: '/*', end: '*/' } },
  ruby: { line: '#', block: { start: '=begin', end: '=end' } },
  shell: { line: '#' },
  bash: { line: '#' },
  sql: { line: '--', block: { start: '/*', end: '*/' } },
};

/**
 * Get comment syntax for a language
 */
export function getCommentSyntax(language: string): CommentSyntax {
  return COMMENT_SYNTAX[language.toLowerCase()] || { line: '//' };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all lines from content
 */
function getAllLines(content: string): string[] {
  return content.split('\n');
}

/**
 * Get the indentation string (spaces or tabs) from a line
 */
function getIndentation(line: string): string {
  const match = line.match(/^(\s*)/);
  return match ? match[1] : '';
}

/**
 * Check if a line is commented
 */
function isLineCommented(line: string, commentPrefix: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith(commentPrefix);
}

/**
 * Get the range of lines affected by the current selection
 */
export function getSelectionLineRange(selection: Selection): { start: number; end: number } {
  const startLine = Math.min(selection.anchorLine, selection.headLine);
  const endLine = Math.max(selection.anchorLine, selection.headLine);
  return { start: startLine, end: endLine };
}

// ============================================================================
// Editor Operations
// ============================================================================

/**
 * Toggle line comment for the current line or selection
 * Returns an array of EditOperations (one per line in the selection)
 */
export function toggleLineComment(
  content: string,
  selection: Selection,
  language: string
): EditOperation[] {
  const syntax = getCommentSyntax(language);
  const commentPrefix = syntax.line;

  // If no line comment syntax available, cannot comment
  if (!commentPrefix) {
    console.warn(`[EditorOperations] No line comment syntax for language: ${language}`);
    return [];
  }

  const { start: startLine, end: endLine } = getSelectionLineRange(selection);
  const lines = getAllLines(content);
  const operations: EditOperation[] = [];

  // Check if all non-empty lines in selection are already commented
  let allCommented = true;
  let hasNonEmptyLine = false;
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = lines[lineNum];
    const trimmed = line?.trim() || '';
    if (trimmed !== '') {
      hasNonEmptyLine = true;
      if (!isLineCommented(line, commentPrefix)) {
        allCommented = false;
        break;
      }
    }
  }

  // If all lines are empty, treat as uncommented
  if (!hasNonEmptyLine) {
    allCommented = false;
  }

  // Toggle comment for each line
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = lines[lineNum];
    if (line === undefined) continue; // Skip invalid lines

    const indentation = getIndentation(line);
    const trimmed = line.trimStart();

    if (allCommented) {
      // Remove comment
      if (isLineCommented(line, commentPrefix)) {
        let newText = trimmed.slice(commentPrefix.length);
        // Remove one space after comment prefix if present
        if (newText.startsWith(' ')) {
          newText = newText.slice(1);
        }
        operations.push({
          range: {
            startLine: lineNum,
            startCol: 0,
            endLine: lineNum,
            endCol: line.length,
          },
          newText: indentation + newText,
        });
      }
    } else {
      // Add comment
      if (trimmed === '') {
        // Empty line - just add comment prefix
        operations.push({
          range: {
            startLine: lineNum,
            startCol: 0,
            endLine: lineNum,
            endCol: line.length,
          },
          newText: indentation + commentPrefix,
        });
      } else {
        operations.push({
          range: {
            startLine: lineNum,
            startCol: 0,
            endLine: lineNum,
            endCol: line.length,
          },
          newText: indentation + commentPrefix + ' ' + trimmed,
        });
      }
    }
  }

  return operations;
}

/**
 * Duplicate the current line or selection
 * Returns a single EditOperation that inserts the duplicated content
 */
export function duplicateLine(content: string, selection: Selection): EditOperation {
  const { start: startLine, end: endLine } = getSelectionLineRange(selection);
  const lines = getAllLines(content);

  // Get all lines in the selection and duplicate them
  const duplicatedText = lines.slice(startLine, endLine + 1).join('\n');

  // Insert the duplicated text after the last selected line
  const insertLine = endLine;
  const insertCol = lines[insertLine]?.length || 0;

  return {
    range: {
      startLine: insertLine,
      startCol: insertCol,
      endLine: insertLine,
      endCol: insertCol,
    },
    newText: '\n' + duplicatedText,
  };
}

/**
 * Move line(s) up
 * Returns an array of EditOperations to swap the lines
 */
export function moveLineUp(content: string, selection: Selection): EditOperation[] {
  const { start: startLine, end: endLine } = getSelectionLineRange(selection);
  const lines = getAllLines(content);

  // Cannot move up if already at the top
  if (startLine === 0) {
    return [];
  }

  const operations: EditOperation[] = [];

  // Get the line above the selection
  const lineAbove = lines[startLine - 1];

  // Delete the line above
  operations.push({
    range: {
      startLine: startLine - 1,
      startCol: 0,
      endLine: startLine - 1,
      endCol: lineAbove.length,
    },
    newText: '',
  });

  // Insert the line above after the selected lines
  const lastSelectedLine = lines[endLine];
  operations.push({
    range: {
      startLine: endLine,
      startCol: lastSelectedLine.length,
      endLine: endLine,
      endCol: lastSelectedLine.length,
    },
    newText: '\n' + lineAbove,
  });

  return operations;
}

/**
 * Move line(s) down
 * Returns an array of EditOperations to swap the lines
 */
export function moveLineDown(content: string, selection: Selection): EditOperation[] {
  const { start: startLine, end: endLine } = getSelectionLineRange(selection);
  const lines = getAllLines(content);

  // Cannot move down if already at the bottom
  if (endLine >= lines.length - 1) {
    return [];
  }

  const operations: EditOperation[] = [];

  // Get the line below the selection
  const lineBelow = lines[endLine + 1];

  // Delete the line below
  operations.push({
    range: {
      startLine: endLine + 1,
      startCol: 0,
      endLine: endLine + 1,
      endCol: lineBelow.length,
    },
    newText: '',
  });

  // Insert the line below before the selected lines
  operations.push({
    range: {
      startLine: startLine - 1,
      startCol: lines[startLine - 1]?.length || 0,
      endLine: startLine - 1,
      endCol: lines[startLine - 1]?.length || 0,
    },
    newText: '\n' + lineBelow,
  });

  return operations;
}

/**
 * Indent line(s)
 * Returns an array of EditOperations to add indentation
 */
export function indentLine(
  content: string,
  selection: Selection,
  tabSize: number = 2,
  useSpaces: boolean = true
): EditOperation[] {
  const { start: startLine, end: endLine } = getSelectionLineRange(selection);
  const lines = getAllLines(content);
  const operations: EditOperation[] = [];

  const indentString = useSpaces ? ' '.repeat(tabSize) : '\t';

  // Add indentation to each line
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = lines[lineNum];
    if (!line && lineNum >= lines.length) continue;

    operations.push({
      range: {
        startLine: lineNum,
        startCol: 0,
        endLine: lineNum,
        endCol: 0,
      },
      newText: indentString,
    });
  }

  return operations;
}

/**
 * Outdent line(s)
 * Returns an array of EditOperations to remove indentation
 */
export function outdentLine(
  content: string,
  selection: Selection,
  tabSize: number = 2
): EditOperation[] {
  const { start: startLine, end: endLine } = getSelectionLineRange(selection);
  const lines = getAllLines(content);
  const operations: EditOperation[] = [];

  // Remove indentation from each line
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const line = lines[lineNum];
    if (!line && lineNum >= lines.length) continue;

    // Check if line starts with tab or spaces
    let removeCount = 0;
    if (line.startsWith('\t')) {
      removeCount = 1;
    } else if (line.startsWith(' ')) {
      // Remove up to tabSize spaces
      for (let i = 0; i < tabSize && i < line.length && line[i] === ' '; i++) {
        removeCount++;
      }
    }

    if (removeCount > 0) {
      operations.push({
        range: {
          startLine: lineNum,
          startCol: 0,
          endLine: lineNum,
          endCol: removeCount,
        },
        newText: '',
      });
    }
  }

  return operations;
}
