/**
 * Tests for the Mock System
 *
 * Tests the sample project data and utility functions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEMO_PROJECT,
  findMockFile,
  getMockDirectoryChildren,
  getMockFileContent,
  searchMockFiles,
  searchMockContent,
  getDemoWorkspacePath,
} from '../../src/lib/mocks/data/sample-project';

describe('Sample Project Data', () => {
  describe('DEMO_PROJECT structure', () => {
    it('has correct root properties', () => {
      expect(DEMO_PROJECT.name).toBe('demo-project');
      expect(DEMO_PROJECT.path).toBe('/demo-project');
      expect(DEMO_PROJECT.isDirectory).toBe(true);
      expect(DEMO_PROJECT.children).toBeDefined();
      expect(DEMO_PROJECT.children!.length).toBeGreaterThan(0);
    });

    it('contains expected directories', () => {
      const childNames = DEMO_PROJECT.children!.map((c) => c.name);
      expect(childNames).toContain('src');
      expect(childNames).toContain('tests');
    });

    it('contains expected files', () => {
      const childNames = DEMO_PROJECT.children!.map((c) => c.name);
      expect(childNames).toContain('package.json');
      expect(childNames).toContain('README.md');
      expect(childNames).toContain('tsconfig.json');
    });

    it('src directory contains TypeScript files', () => {
      const src = DEMO_PROJECT.children!.find((c) => c.name === 'src');
      expect(src).toBeDefined();
      expect(src!.isDirectory).toBe(true);
      expect(src!.children).toBeDefined();

      const srcFiles = src!.children!.map((c) => c.name);
      expect(srcFiles).toContain('main.ts');
      expect(srcFiles).toContain('utils.ts');
      expect(srcFiles).toContain('types.ts');
    });
  });

  describe('getDemoWorkspacePath', () => {
    it('returns the correct workspace path', () => {
      expect(getDemoWorkspacePath()).toBe('/demo-project');
    });
  });

  describe('findMockFile', () => {
    it('finds the root directory', () => {
      const file = findMockFile('/demo-project');
      expect(file).toBeDefined();
      expect(file!.name).toBe('demo-project');
      expect(file!.isDirectory).toBe(true);
    });

    it('finds nested directories', () => {
      const src = findMockFile('/demo-project/src');
      expect(src).toBeDefined();
      expect(src!.name).toBe('src');
      expect(src!.isDirectory).toBe(true);
    });

    it('finds files', () => {
      const mainTs = findMockFile('/demo-project/src/main.ts');
      expect(mainTs).toBeDefined();
      expect(mainTs!.name).toBe('main.ts');
      expect(mainTs!.isDirectory).toBe(false);
      expect(mainTs!.content).toBeDefined();
    });

    it('returns null for non-existent paths', () => {
      expect(findMockFile('/non-existent')).toBeNull();
      expect(findMockFile('/demo-project/not-a-file.txt')).toBeNull();
    });
  });

  describe('getMockDirectoryChildren', () => {
    it('returns children of the root directory', () => {
      const children = getMockDirectoryChildren('/demo-project');
      expect(children).toBeDefined();
      expect(children!.length).toBeGreaterThan(0);
    });

    it('returns children of nested directories', () => {
      const srcChildren = getMockDirectoryChildren('/demo-project/src');
      expect(srcChildren).toBeDefined();
      expect(srcChildren!.some((c) => c.name === 'main.ts')).toBe(true);
    });

    it('returns null for files', () => {
      expect(getMockDirectoryChildren('/demo-project/package.json')).toBeNull();
    });

    it('returns null for non-existent paths', () => {
      expect(getMockDirectoryChildren('/non-existent')).toBeNull();
    });
  });

  describe('getMockFileContent', () => {
    it('returns content of TypeScript files', () => {
      const content = getMockFileContent('/demo-project/src/main.ts');
      expect(content).toBeDefined();
      expect(content).toContain('import');
      expect(content).toContain('interface User');
    });

    it('returns content of package.json', () => {
      const content = getMockFileContent('/demo-project/package.json');
      expect(content).toBeDefined();
      const parsed = JSON.parse(content!);
      expect(parsed.name).toBe('demo-project');
    });

    it('returns null for directories', () => {
      expect(getMockFileContent('/demo-project/src')).toBeNull();
    });

    it('returns null for non-existent files', () => {
      expect(getMockFileContent('/demo-project/not-a-file.txt')).toBeNull();
    });
  });

  describe('searchMockFiles', () => {
    it('finds files by exact name match', () => {
      const results = searchMockFiles('main.ts');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name === 'main.ts')).toBe(true);
    });

    it('finds files by partial name match', () => {
      const results = searchMockFiles('main');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.name.includes('main'))).toBe(true);
    });

    it('finds multiple matching files', () => {
      const results = searchMockFiles('.ts');
      expect(results.length).toBeGreaterThan(3); // main.ts, utils.ts, types.ts, etc.
    });

    it('scores exact matches higher', () => {
      const results = searchMockFiles('main.ts');
      const mainTs = results.find((r) => r.name === 'main.ts');
      expect(mainTs).toBeDefined();
      expect(mainTs!.score).toBe(100); // Exact match score
    });

    it('respects maxResults limit', () => {
      const results = searchMockFiles('t', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('returns empty array for no matches', () => {
      const results = searchMockFiles('nonexistentfile');
      expect(results).toEqual([]);
    });

    it('is case-insensitive', () => {
      const results = searchMockFiles('MAIN');
      expect(results.some((r) => r.name.toLowerCase().includes('main'))).toBe(true);
    });
  });

  describe('searchMockContent', () => {
    it('finds content matches in files', () => {
      const results = searchMockContent('function');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.line_content.includes('function'))).toBe(true);
    });

    it('returns correct line numbers', () => {
      const results = searchMockContent('interface User');
      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.path === '/demo-project/src/main.ts');
      expect(match).toBeDefined();
      expect(match!.line_number).toBeGreaterThan(0);
    });

    it('returns match positions', () => {
      const results = searchMockContent('greet');
      expect(results.length).toBeGreaterThan(0);
      const match = results[0];
      expect(match.match_start).toBeGreaterThanOrEqual(0);
      expect(match.match_end).toBeGreaterThan(match.match_start);
    });

    it('respects maxResults limit', () => {
      const results = searchMockContent('const', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('is case-insensitive', () => {
      const results = searchMockContent('EXPORT');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array for no matches', () => {
      const results = searchMockContent('xyznonexistentstring123');
      expect(results).toEqual([]);
    });
  });
});

describe('Mock File Properties', () => {
  it('files have git status indicators', () => {
    // Check for modified file
    const mainTs = findMockFile('/demo-project/src/main.ts');
    expect(mainTs?.gitStatus).toBe('M');

    // Check for added file
    const newFile = findMockFile('/demo-project/new-file.ts');
    expect(newFile?.gitStatus).toBe('A');

    // Check for normal file
    const utils = findMockFile('/demo-project/src/utils.ts');
    expect(utils?.gitStatus).toBeNull();
  });

  it('files have timestamps', () => {
    const mainTs = findMockFile('/demo-project/src/main.ts');
    expect(mainTs?.modified).toBeDefined();
    expect(mainTs?.modified).toBeGreaterThan(0);
  });

  it('files have size information', () => {
    const mainTs = findMockFile('/demo-project/src/main.ts');
    expect(mainTs?.size).toBeDefined();
    expect(mainTs?.size).toBeGreaterThan(0);
  });
});
