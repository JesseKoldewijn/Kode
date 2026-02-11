/**
 * Sample Demo Project Data
 *
 * This file contains a mock file system structure used when running
 * Kode in browser mode (outside of Tauri).
 */

export interface MockFile {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modified: number;
  gitStatus: string | null;
  content?: string;
  children?: MockFile[];
}

// Timestamp for mock files (recent)
const NOW = Date.now();
const HOUR_AGO = NOW - 3600000;
const DAY_AGO = NOW - 86400000;

export const DEMO_PROJECT: MockFile = {
  name: 'demo-project',
  path: '/demo-project',
  isDirectory: true,
  isSymlink: false,
  size: 0,
  modified: NOW,
  gitStatus: null,
  children: [
    {
      name: 'src',
      path: '/demo-project/src',
      isDirectory: true,
      isSymlink: false,
      size: 0,
      modified: HOUR_AGO,
      gitStatus: null,
      children: [
        {
          name: 'main.ts',
          path: '/demo-project/src/main.ts',
          isDirectory: false,
          isSymlink: false,
          size: 245,
          modified: HOUR_AGO,
          gitStatus: 'M',
          content: `/**
 * Main entry point for the demo application
 */

import { greet } from './utils';

interface User {
  name: string;
  email: string;
}

const user: User = {
  name: 'World',
  email: 'hello@example.com',
};

console.log(greet(user.name));

export { User };
`,
        },
        {
          name: 'utils.ts',
          path: '/demo-project/src/utils.ts',
          isDirectory: false,
          isSymlink: false,
          size: 312,
          modified: DAY_AGO,
          gitStatus: null,
          content: `/**
 * Utility functions for the demo application
 */

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
`,
        },
        {
          name: 'types.ts',
          path: '/demo-project/src/types.ts',
          isDirectory: false,
          isSymlink: false,
          size: 189,
          modified: DAY_AGO,
          gitStatus: null,
          content: `/**
 * Type definitions
 */

export interface Config {
  apiUrl: string;
  timeout: number;
  debug: boolean;
}

export type Status = 'idle' | 'loading' | 'success' | 'error';

export interface ApiResponse<T> {
  data: T;
  status: Status;
  message?: string;
}
`,
        },
        {
          name: 'components',
          path: '/demo-project/src/components',
          isDirectory: true,
          isSymlink: false,
          size: 0,
          modified: HOUR_AGO,
          gitStatus: null,
          children: [
            {
              name: 'chat',
              path: '/demo-project/src/components/chat',
              isDirectory: true,
              isSymlink: false,
              size: 0,
              modified: HOUR_AGO,
              gitStatus: null,
              children: [
                {
                  name: 'ChatPanel.ripple',
                  path: '/demo-project/src/components/chat/ChatPanel.ripple',
                  isDirectory: false,
                  isSymlink: false,
                  size: 512,
                  modified: HOUR_AGO,
                  gitStatus: null,
                  content: `export component ChatPanel() {
  {"Chat panel placeholder"}
}
`,
                },
                {
                  name: 'ChatInput.ripple',
                  path: '/demo-project/src/components/chat/ChatInput.ripple',
                  isDirectory: false,
                  isSymlink: false,
                  size: 256,
                  modified: HOUR_AGO,
                  gitStatus: null,
                  content: `export component ChatInput() {
  {"Chat input placeholder"}
}
`,
                },
              ],
            },
            {
              name: 'editor',
              path: '/demo-project/src/components/editor',
              isDirectory: true,
              isSymlink: false,
              size: 0,
              modified: HOUR_AGO,
              gitStatus: null,
              children: [
                {
                  name: 'EditorTabs.ripple',
                  path: '/demo-project/src/components/editor/EditorTabs.ripple',
                  isDirectory: false,
                  isSymlink: false,
                  size: 320,
                  modified: HOUR_AGO,
                  gitStatus: null,
                  content: `export component EditorTabs() {
  {"Editor tabs placeholder"}
}
`,
                },
              ],
            },
          ],
        },
        {
          name: 'lib',
          path: '/demo-project/src/lib',
          isDirectory: true,
          isSymlink: false,
          size: 0,
          modified: HOUR_AGO,
          gitStatus: null,
          children: [
            {
              name: 'workspace.ts',
              path: '/demo-project/src/lib/workspace.ts',
              isDirectory: false,
              isSymlink: false,
              size: 1024,
              modified: DAY_AGO,
              gitStatus: null,
              content: `/**
 * Workspace utilities
 */
export function getWorkspacePath(): string {
  return '/demo-project';
}
`,
            },
            {
              name: 'theme.ts',
              path: '/demo-project/src/lib/theme.ts',
              isDirectory: false,
              isSymlink: false,
              size: 256,
              modified: DAY_AGO,
              gitStatus: null,
              content: `/**
 * Theme utilities
 */
export type Theme = 'dark' | 'light' | 'system';
`,
            },
          ],
        },
      ],
    },
    {
      name: 'tests',
      path: '/demo-project/tests',
      isDirectory: true,
      isSymlink: false,
      size: 0,
      modified: DAY_AGO,
      gitStatus: null,
      children: [
        {
          name: 'utils.test.ts',
          path: '/demo-project/tests/utils.test.ts',
          isDirectory: false,
          isSymlink: false,
          size: 423,
          modified: DAY_AGO,
          gitStatus: null,
          content: `import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide, greet } from '../src/utils';

describe('Math utilities', () => {
  it('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('subtracts two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  it('multiplies two numbers', () => {
    expect(multiply(4, 3)).toBe(12);
  });

  it('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('throws on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });
});

describe('greet', () => {
  it('greets a user', () => {
    expect(greet('Alice')).toBe('Hello, Alice!');
  });
});
`,
        },
      ],
    },
    {
      name: 'package.json',
      path: '/demo-project/package.json',
      isDirectory: false,
      isSymlink: false,
      size: 287,
      modified: DAY_AGO,
      gitStatus: null,
      content: JSON.stringify(
        {
          name: 'demo-project',
          version: '1.0.0',
          description: 'A demo project for testing Kode',
          type: 'module',
          scripts: {
            build: 'tsc',
            dev: 'ts-node src/main.ts',
            test: 'vitest',
          },
          devDependencies: {
            typescript: '^5.0.0',
            vitest: '^1.0.0',
          },
        },
        null,
        2
      ),
    },
    {
      name: 'tsconfig.json',
      path: '/demo-project/tsconfig.json',
      isDirectory: false,
      isSymlink: false,
      size: 198,
      modified: DAY_AGO,
      gitStatus: null,
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            outDir: './dist',
            rootDir: './src',
          },
          include: ['src/**/*'],
          exclude: ['node_modules'],
        },
        null,
        2
      ),
    },
    {
      name: 'README.md',
      path: '/demo-project/README.md',
      isDirectory: false,
      isSymlink: false,
      size: 456,
      modified: DAY_AGO,
      gitStatus: null,
      content: `# Demo Project

This is a demo project for testing **Kode** in browser mode.

## Features

- TypeScript support
- Basic file structure
- Unit tests with Vitest

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
\`\`\`

## Project Structure

\`\`\`
demo-project/
├── src/
│   ├── main.ts      # Entry point
│   ├── utils.ts     # Utility functions
│   └── types.ts     # Type definitions
├── tests/
│   └── utils.test.ts
├── package.json
├── tsconfig.json
└── README.md
\`\`\`
`,
    },
    {
      name: '.gitignore',
      path: '/demo-project/.gitignore',
      isDirectory: false,
      isSymlink: false,
      size: 45,
      modified: DAY_AGO,
      gitStatus: null,
      content: `node_modules/
dist/
*.log
.env
.DS_Store
`,
    },
    {
      name: 'new-file.ts',
      path: '/demo-project/new-file.ts',
      isDirectory: false,
      isSymlink: false,
      size: 89,
      modified: NOW,
      gitStatus: 'A',
      content: `// This is a newly added file
export const newFeature = () => {
  console.log('New feature!');
};
`,
    },
  ],
};

/**
 * Get the workspace root path for the demo project
 */
export function getDemoWorkspacePath(): string {
  return DEMO_PROJECT.path;
}

/**
 * Find a file or directory in the demo project by path
 */
export function findMockFile(path: string): MockFile | null {
  if (path === DEMO_PROJECT.path) {
    return DEMO_PROJECT;
  }

  function search(node: MockFile): MockFile | null {
    if (node.path === path) {
      return node;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = search(child);
        if (found) return found;
      }
    }
    return null;
  }

  return search(DEMO_PROJECT);
}

/**
 * Get children of a directory (for readDirectory mock)
 */
export function getMockDirectoryChildren(path: string): MockFile[] | null {
  const dir = findMockFile(path);
  if (!dir || !dir.isDirectory) {
    return null;
  }
  return dir.children || [];
}

/**
 * Get file content (for readFile mock)
 */
export function getMockFileContent(path: string): string | null {
  const file = findMockFile(path);
  if (!file || file.isDirectory) {
    return null;
  }
  return file.content || '';
}

/**
 * Search files by name (fuzzy match for searchFiles mock)
 */
export function searchMockFiles(
  query: string,
  maxResults: number = 20
): Array<{ path: string; name: string; score: number }> {
  const results: Array<{ path: string; name: string; score: number }> = [];
  const queryLower = query.toLowerCase();

  function search(node: MockFile): void {
    if (results.length >= maxResults) return;

    const nameLower = node.name.toLowerCase();
    if (nameLower.includes(queryLower)) {
      // Simple scoring: exact match = 100, starts with = 75, contains = 50
      let score = 50;
      if (nameLower === queryLower) score = 100;
      else if (nameLower.startsWith(queryLower)) score = 75;

      if (!node.isDirectory) {
        results.push({ path: node.path, name: node.name, score });
      }
    }

    if (node.children) {
      for (const child of node.children) {
        search(child);
      }
    }
  }

  search(DEMO_PROJECT);
  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

/**
 * Search content in files (grep-like for searchContent mock)
 */
export function searchMockContent(
  query: string,
  maxResults: number = 50
): Array<{
  path: string;
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
}> {
  const results: Array<{
    path: string;
    line_number: number;
    line_content: string;
    match_start: number;
    match_end: number;
  }> = [];

  function search(node: MockFile): void {
    if (results.length >= maxResults) return;

    if (!node.isDirectory && node.content) {
      const lines = node.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break;

        const line = lines[i];
        const matchIndex = line.toLowerCase().indexOf(query.toLowerCase());
        if (matchIndex !== -1) {
          results.push({
            path: node.path,
            line_number: i + 1,
            line_content: line,
            match_start: matchIndex,
            match_end: matchIndex + query.length,
          });
        }
      }
    }

    if (node.children) {
      for (const child of node.children) {
        search(child);
      }
    }
  }

  search(DEMO_PROJECT);
  return results;
}
