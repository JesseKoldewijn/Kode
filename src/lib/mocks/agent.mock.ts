/**
 * Agent Mock Handlers
 *
 * Provides mock implementations for AI agent-related Tauri commands
 * when running in browser mode. Simulates a conversational AI assistant.
 */

import { emit } from '@tauri-apps/api/event';

// Store active agent sessions
const agents = new Map<
  string,
  {
    id: string;
    command: string;
    isRunning: boolean;
    messageCount: number;
  }
>();

// Simulated AI responses based on keywords
const AI_RESPONSES: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ['hello', 'hi', 'hey'],
    response: `Hello! I'm your AI coding assistant running in demo mode.

I can help you with:
- Writing and explaining code
- Debugging issues
- Suggesting improvements
- Answering programming questions

What would you like to work on today?`,
  },
  {
    keywords: ['help', 'what can you do', 'capabilities'],
    response: `I'm an AI coding assistant. Here's what I can help with:

**Code Tasks:**
- Write new code or functions
- Explain existing code
- Debug errors
- Refactor for better practices

**Languages I know well:**
- TypeScript/JavaScript
- Python
- Rust
- Go
- And many more!

**Demo Note:** This is a simulated response. In the full version, I'm connected to a real AI agent.`,
  },
  {
    keywords: ['typescript', 'ts', 'type'],
    response: `Here's an example TypeScript function with proper typing:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User | null> {
  try {
    const response = await fetch(\`/api/users/\${id}\`);
    if (!response.ok) return null;
    return await response.json() as User;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}
\`\`\`

This demonstrates:
- Interface definition for type safety
- Async/await pattern
- Error handling
- Return type annotation`,
  },
  {
    keywords: ['function', 'write', 'create', 'implement'],
    response: `I'd be happy to help you write a function! Here's an example:

\`\`\`typescript
/**
 * Debounces a function call
 * @param fn - The function to debounce
 * @param delay - Delay in milliseconds
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
\`\`\`

To write code for you, please describe:
1. What the function should do
2. Input parameters
3. Expected output`,
  },
  {
    keywords: ['error', 'bug', 'fix', 'debug'],
    response: `I can help debug your code! To assist effectively, please share:

1. **The error message** - Copy the full error
2. **The code** - The relevant code snippet
3. **Expected behavior** - What should happen
4. **Actual behavior** - What's happening instead

Common debugging steps:
- Check the stack trace for line numbers
- Add console.log statements
- Verify variable types
- Check for null/undefined values
- Review async/await usage

Paste your code and error, and I'll help identify the issue!`,
  },
  {
    keywords: ['test', 'testing', 'vitest', 'jest'],
    response: `Here's an example test using Vitest:

\`\`\`typescript
import { describe, it, expect, vi } from 'vitest';
import { calculateTotal } from './utils';

describe('calculateTotal', () => {
  it('calculates sum correctly', () => {
    expect(calculateTotal([10, 20, 30])).toBe(60);
  });

  it('returns 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('handles negative numbers', () => {
    expect(calculateTotal([10, -5, 15])).toBe(20);
  });
});
\`\`\`

Best practices:
- Test edge cases (empty, null, negative)
- Use descriptive test names
- One assertion per test when possible
- Mock external dependencies`,
  },
];

// Default response when no keywords match
const DEFAULT_RESPONSE = `I understand you're asking about that. In this demo mode, I can provide simulated responses.

Here are some topics I can demonstrate:
- Type "typescript" for TypeScript examples
- Type "function" to see function writing
- Type "test" for testing examples
- Type "debug" for debugging tips
- Type "help" for more options

In the full version, I'd be connected to a real AI model that can understand and respond to any programming question!`;

/**
 * Handle agent commands
 */
export function handleAgentCommand(cmd: string, args: Record<string, unknown>): unknown {
  switch (cmd) {
    case 'start_agent':
      return handleStartAgent(
        args.id as string,
        args.command as string,
        args.args as string[],
        args.cwd as string | undefined
      );

    case 'send_to_agent':
      return handleSendToAgent(args.id as string, args.data as string);

    case 'stop_agent':
      return handleStopAgent(args.id as string);

    default:
      console.warn(`[Mock Agent] Unhandled command: ${cmd}`);
      return null;
  }
}

async function handleStartAgent(
  id: string,
  command: string,
  _args: string[],
  _cwd?: string
): Promise<void> {
  agents.set(id, {
    id,
    command,
    isRunning: true,
    messageCount: 0,
  });

  console.log(`[Mock Agent] Started agent: ${id} (${command})`);

  // Send initial greeting after a short delay
  await new Promise((r) => setTimeout(r, 300));

  await emitAgentOutput(
    id,
    'stdout',
    `[Demo Mode] AI agent initialized successfully.
Type a message to start chatting!
`
  );
}

async function handleSendToAgent(id: string, data: string): Promise<void> {
  const agent = agents.get(id);
  if (!agent) {
    console.warn(`[Mock Agent] Agent not found: ${id}`);
    return;
  }

  if (!agent.isRunning) {
    console.warn(`[Mock Agent] Agent not running: ${id}`);
    return;
  }

  agent.messageCount++;
  console.log(`[Mock Agent] Message to ${id}: ${data.substring(0, 50)}...`);

  // Simulate thinking delay
  const thinkingDelay = 500 + Math.random() * 1000;
  await new Promise((r) => setTimeout(r, thinkingDelay));

  // Find matching response
  const response = findResponse(data);

  // Simulate streaming by sending chunks
  await streamResponse(id, response);
}

function handleStopAgent(id: string): void {
  const agent = agents.get(id);
  if (agent) {
    agent.isRunning = false;
    agents.delete(id);

    // Emit exit event
    emit('agent-exit', { id, code: 0 }).catch(console.error);
  }
  console.log(`[Mock Agent] Stopped agent: ${id}`);
}

function findResponse(message: string): string {
  const messageLower = message.toLowerCase();

  for (const { keywords, response } of AI_RESPONSES) {
    if (keywords.some((kw) => messageLower.includes(kw))) {
      return response;
    }
  }

  return DEFAULT_RESPONSE;
}

async function streamResponse(id: string, response: string): Promise<void> {
  // Split response into chunks to simulate streaming
  const words = response.split(' ');
  let chunk = '';
  const chunkSize = 3 + Math.floor(Math.random() * 5); // 3-7 words per chunk

  for (let i = 0; i < words.length; i++) {
    chunk += (chunk ? ' ' : '') + words[i];

    if ((i + 1) % chunkSize === 0 || i === words.length - 1) {
      await emitAgentOutput(id, 'stdout', chunk + ' ');
      chunk = '';
      // Small delay between chunks
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }

  // Final newline
  await emitAgentOutput(id, 'stdout', '\n');
}

async function emitAgentOutput(
  id: string,
  stream: 'stdout' | 'stderr',
  data: string
): Promise<void> {
  try {
    await emit('agent-output', { id, stream, data });
  } catch (e) {
    // If emit fails (e.g., during tests), log it
    console.log(`[Mock Agent] Output for ${id} (${stream}):`, data);
  }
}

/**
 * Reset agent mocks (useful for tests)
 */
export function resetAgentMocks(): void {
  // Stop all agents
  for (const id of agents.keys()) {
    handleStopAgent(id);
  }
  agents.clear();
}

/**
 * Get active agent IDs (useful for debugging)
 */
export function getActiveAgents(): string[] {
  return Array.from(agents.keys());
}

/**
 * Check if an agent is running
 */
export function isAgentRunning(id: string): boolean {
  return agents.get(id)?.isRunning ?? false;
}
