/**
 * Terminal Mock Handlers
 *
 * Provides mock implementations for terminal-related Tauri commands
 * when running in browser mode. Simulates a basic shell experience.
 */

import { emit } from '@tauri-apps/api/event';

// Store active terminal sessions
const terminals = new Map<
  string,
  {
    id: string;
    cwd: string;
    history: string[];
    isRunning: boolean;
  }
>();

// Simulated command responses
const MOCK_COMMANDS: Record<string, (args: string[], cwd: string) => string> = {
  pwd: (_args, cwd) => cwd,

  ls: (_args, cwd) => {
    if (cwd === '/demo-project') {
      return 'src/  tests/  package.json  tsconfig.json  README.md  .gitignore  new-file.ts';
    }
    if (cwd === '/demo-project/src') {
      return 'main.ts  utils.ts  types.ts';
    }
    return 'file1.txt  file2.txt  directory/';
  },

  echo: (args) => args.join(' '),

  cat: (args) => {
    const file = args[0];
    if (file === 'package.json') {
      return JSON.stringify({ name: 'demo-project', version: '1.0.0' }, null, 2);
    }
    return `Contents of ${file}`;
  },

  whoami: () => 'demo-user',

  date: () => new Date().toString(),

  clear: () => '\x1b[2J\x1b[H',

  help: () => `Available commands:
  pwd     - Print working directory
  ls      - List directory contents
  cd      - Change directory
  echo    - Print text
  cat     - Display file contents
  whoami  - Print current user
  date    - Print current date/time
  clear   - Clear the terminal
  help    - Show this help message
  
Note: This is a mock terminal for demo purposes.`,

  node: (args) => {
    if (args[0] === '-v' || args[0] === '--version') {
      return 'v20.10.0';
    }
    return 'Node.js mock - interactive mode not supported';
  },

  npm: (args) => {
    if (args[0] === '-v' || args[0] === '--version') {
      return '10.2.0';
    }
    if (args[0] === 'run') {
      return `> demo-project@1.0.0 ${args[1] || 'script'}
> Running ${args[1] || 'script'}...

Script completed successfully.`;
    }
    return 'npm mock - command simulated';
  },

  git: (args) => {
    if (args[0] === 'status') {
      return `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
        modified:   src/main.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        new-file.ts

no changes added to commit (use "git add" and/or "git commit -a")`;
    }
    if (args[0] === 'branch') {
      return '* main\n  feature/demo\n  develop';
    }
    return `git ${args.join(' ')} - simulated`;
  },
};

/**
 * Handle terminal commands
 */
export function handleTerminalCommand(cmd: string, args: Record<string, unknown>): unknown {
  switch (cmd) {
    case 'spawn_terminal':
      return handleSpawnTerminal(
        args.id as string,
        args.shell as string | undefined,
        args.cwd as string | undefined
      );

    case 'write_terminal':
      return handleWriteTerminal(args.id as string, args.data as string);

    case 'resize_terminal':
      return handleResizeTerminal(args.id as string, args.rows as number, args.cols as number);

    case 'close_terminal':
      return handleCloseTerminal(args.id as string);

    default:
      console.warn(`[Mock Terminal] Unhandled command: ${cmd}`);
      return null;
  }
}

async function handleSpawnTerminal(id: string, _shell?: string, cwd?: string): Promise<void> {
  const terminalCwd = cwd || '/demo-project';

  terminals.set(id, {
    id,
    cwd: terminalCwd,
    history: [],
    isRunning: true,
  });

  console.log(`[Mock Terminal] Spawned terminal: ${id} at ${terminalCwd}`);

  // send welcome message
  await emitTerminalOutput(
    id,
    `\n\x1b[32mdemo-user\x1b[0m@\x1b[34mjekode\x1b[0m:\x1b[33m${terminalCwd}\x1b[0m$ `
  );
}

async function handleWriteTerminal(id: string, data: string): Promise<void> {
  const terminal = terminals.get(id);
  if (!terminal) {
    console.warn(`[Mock Terminal] Terminal not found: ${id}`);
    return;
  }

  // Handle special characters
  if (data === '\r' || data === '\n') {
    // Execute the accumulated command
    const cmdLine = terminal.history.join('').trim();
    terminal.history = [];

    if (cmdLine) {
      // Echo the newline
      await emitTerminalOutput(id, '\r\n');

      // Parse and execute command
      const output = executeCommand(cmdLine, terminal.cwd);

      // Handle cd specially
      if (cmdLine.startsWith('cd ')) {
        const newDir = cmdLine.slice(3).trim();
        if (newDir === '..' && terminal.cwd !== '/') {
          terminal.cwd = terminal.cwd.split('/').slice(0, -1).join('/') || '/';
        } else if (newDir.startsWith('/')) {
          terminal.cwd = newDir;
        } else {
          terminal.cwd = `${terminal.cwd}/${newDir}`.replace('//', '/');
        }
      }

      if (output) {
        await emitTerminalOutput(id, output + '\r\n');
      }
    } else {
      await emitTerminalOutput(id, '\r\n');
    }

    // Show new prompt
    await emitTerminalOutput(
      id,
      `\x1b[32mdemo-user\x1b[0m@\x1b[34mjekode\x1b[0m:\x1b[33m${terminal.cwd}\x1b[0m$ `
    );
  } else if (data === '\x7f' || data === '\b') {
    // Backspace
    if (terminal.history.length > 0) {
      terminal.history.pop();
      await emitTerminalOutput(id, '\b \b');
    }
  } else if (data.charCodeAt(0) >= 32) {
    // Regular character
    terminal.history.push(data);
    await emitTerminalOutput(id, data);
  }
}

function handleResizeTerminal(id: string, rows: number, cols: number): void {
  const terminal = terminals.get(id);
  if (!terminal) {
    console.warn(`[Mock Terminal] Terminal not found: ${id}`);
    return;
  }
  console.log(`[Mock Terminal] Resize ${id}: ${cols}x${rows}`);
  // In a real implementation, we'd send SIGWINCH to the PTY
}

function handleCloseTerminal(id: string): void {
  terminals.delete(id);
  console.log(`[Mock Terminal] Closed terminal: ${id}`);
}

function executeCommand(cmdLine: string, cwd: string): string {
  const parts = cmdLine.split(/\s+/);
  const cmd = parts[0];
  const args = parts.slice(1);

  // Check for built-in commands
  if (cmd === 'cd') {
    return ''; // cd is handled separately
  }

  const handler = MOCK_COMMANDS[cmd];
  if (handler) {
    try {
      return handler(args, cwd);
    } catch (e) {
      return `\x1b[31mError: ${e}\x1b[0m`;
    }
  }

  return `\x1b[31mCommand not found: ${cmd}\x1b[0m\nType 'help' for available commands.`;
}

async function emitTerminalOutput(id: string, data: string): Promise<void> {
  // Small delay to simulate real terminal latency
  await new Promise((r) => setTimeout(r, 10));

  try {
    await emit('terminal-output', { id, data });
  } catch (e) {
    // If emit fails (e.g., during tests), log it
    console.log(`[Mock Terminal] Output for ${id}:`, data);
  }
}

/**
 * Reset terminal mocks (useful for tests)
 */
export function resetTerminalMocks(): void {
  terminals.clear();
}

/**
 * Get active terminal IDs (useful for debugging)
 */
export function getActiveTerminals(): string[] {
  return Array.from(terminals.keys());
}
