/**
 * ANSI escape code utilities for stripping terminal control sequences
 * from text before displaying in non-terminal contexts (like chat).
 */

const ANSI_REGEX = new RegExp(
  // CSI sequences (e.g., colors, cursor movement)
  '\\x1b\\[[0-9;]*[A-Za-z]' +
    '|' +
    // OSC sequences (BEL terminated)
    '\\x1b\\][^\\x07]*\\x07' +
    '|' +
    // OSC sequences (ST terminated)
    '\\x1b\\][^\\x1b]*\\x1b\\\\' +
    '|' +
    // Character set selection
    '\\x1b[()][AB012]' +
    '|' +
    // Other single-char escape sequences
    '\\x1b[=>Nno|}~789Fclm]' +
    '|' +
    // Carriage return
    '\\r',
  'g'
);

/**
 * Strip all ANSI escape codes from a string.
 * Useful for displaying terminal output in non-terminal contexts.
 */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}
