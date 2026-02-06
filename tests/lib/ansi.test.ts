import { describe, it, expect } from 'vitest';
import { stripAnsi } from '../../src/lib/ansi';

describe('stripAnsi', () => {
  describe('clean text', () => {
    it('returns plain text unchanged', () => {
      expect(stripAnsi('Hello, World!')).toBe('Hello, World!');
    });

    it('returns empty string unchanged', () => {
      expect(stripAnsi('')).toBe('');
    });

    it('preserves newlines', () => {
      expect(stripAnsi('line1\nline2\nline3')).toBe('line1\nline2\nline3');
    });

    it('preserves tabs', () => {
      expect(stripAnsi('col1\tcol2\tcol3')).toBe('col1\tcol2\tcol3');
    });
  });

  describe('CSI color sequences', () => {
    it('strips basic foreground colors', () => {
      expect(stripAnsi('\x1b[31mred text\x1b[0m')).toBe('red text');
    });

    it('strips background colors', () => {
      expect(stripAnsi('\x1b[44mblue bg\x1b[0m')).toBe('blue bg');
    });

    it('strips bold/italic/underline', () => {
      expect(stripAnsi('\x1b[1mbold\x1b[22m')).toBe('bold');
      expect(stripAnsi('\x1b[3mitalic\x1b[23m')).toBe('italic');
      expect(stripAnsi('\x1b[4munderline\x1b[24m')).toBe('underline');
    });

    it('strips 256-color sequences', () => {
      expect(stripAnsi('\x1b[38;5;196mred\x1b[0m')).toBe('red');
    });

    it('strips RGB/truecolor sequences', () => {
      expect(stripAnsi('\x1b[38;2;255;0;0mred\x1b[0m')).toBe('red');
    });

    it('strips reset sequence', () => {
      expect(stripAnsi('\x1b[0m')).toBe('');
    });

    it('strips multiple color sequences in one string', () => {
      expect(stripAnsi('\x1b[32mgreen\x1b[0m and \x1b[31mred\x1b[0m')).toBe('green and red');
    });
  });

  describe('CSI cursor sequences', () => {
    it('strips cursor up', () => {
      expect(stripAnsi('\x1b[2Ahello')).toBe('hello');
    });

    it('strips cursor down', () => {
      expect(stripAnsi('\x1b[3Bhello')).toBe('hello');
    });

    it('strips cursor forward/back', () => {
      expect(stripAnsi('\x1b[5Chello\x1b[2D')).toBe('hello');
    });

    it('strips cursor position', () => {
      expect(stripAnsi('\x1b[10;20Hhello')).toBe('hello');
    });

    it('strips erase display', () => {
      expect(stripAnsi('\x1b[2Jhello')).toBe('hello');
    });

    it('strips erase line', () => {
      expect(stripAnsi('\x1b[Khello')).toBe('hello');
    });
  });

  describe('OSC sequences', () => {
    it('strips BEL-terminated OSC', () => {
      expect(stripAnsi('\x1b]0;Window Title\x07hello')).toBe('hello');
    });

    it('strips ST-terminated OSC', () => {
      expect(stripAnsi('\x1b]0;Window Title\x1b\\hello')).toBe('hello');
    });
  });

  describe('carriage return', () => {
    it('strips carriage returns', () => {
      expect(stripAnsi('hello\rworld')).toBe('helloworld');
    });

    it('strips CRLF carriage return part', () => {
      expect(stripAnsi('hello\r\nworld')).toBe('hello\nworld');
    });
  });

  describe('character set selection', () => {
    it('strips character set sequences', () => {
      expect(stripAnsi('\x1b(Bhello')).toBe('hello');
      expect(stripAnsi('\x1b)0hello')).toBe('hello');
    });
  });

  describe('complex real-world output', () => {
    it('strips git status output with colors', () => {
      const input = '\x1b[32m+++ b/file.ts\x1b[0m\n\x1b[31m--- a/file.ts\x1b[0m';
      expect(stripAnsi(input)).toBe('+++ b/file.ts\n--- a/file.ts');
    });

    it('strips npm output with colors and bold', () => {
      const input = '\x1b[1m\x1b[32mnpm\x1b[39m\x1b[22m \x1b[1minstall\x1b[22m completed';
      expect(stripAnsi(input)).toBe('npm install completed');
    });

    it('handles text with no ANSI codes mixed with ANSI text', () => {
      const input = 'normal \x1b[31mred\x1b[0m normal \x1b[34mblue\x1b[0m end';
      expect(stripAnsi(input)).toBe('normal red normal blue end');
    });

    it('handles consecutive escape sequences', () => {
      const input = '\x1b[1m\x1b[31m\x1b[44mbold red on blue\x1b[0m';
      expect(stripAnsi(input)).toBe('bold red on blue');
    });
  });
});
