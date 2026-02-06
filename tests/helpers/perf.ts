/**
 * Performance measurement utilities for tests only.
 * These helpers measure timing to validate performance optimizations.
 */

export interface TimingResult<T> {
  result: T;
  durationMs: number;
}

/**
 * Measure execution time of a synchronous function
 */
export function measureTime<T>(fn: () => T): TimingResult<T> {
  const start = performance.now();
  const result = fn();
  return { result, durationMs: performance.now() - start };
}

/**
 * Measure execution time of an async function
 */
export async function measureTimeAsync<T>(fn: () => Promise<T>): Promise<TimingResult<T>> {
  const start = performance.now();
  const result = await fn();
  return { result, durationMs: performance.now() - start };
}

/**
 * Assert that an operation completed within a time limit.
 * Throws an error if the duration exceeds the maximum.
 */
export function assertFasterThan(durationMs: number, maxMs: number, operation: string): void {
  if (durationMs >= maxMs) {
    throw new Error(
      `Performance assertion failed: ${operation} took ${durationMs.toFixed(2)}ms, expected <${maxMs}ms`
    );
  }
}

/**
 * Generate a large string with specific line endings for testing
 */
export function generateLargeContent(
  lineCount: number,
  lineEnding: '\n' | '\r\n' | '\r' = '\n',
  lineLength: number = 80
): string {
  const line = 'x'.repeat(lineLength);
  const lines: string[] = [];
  for (let i = 0; i < lineCount; i++) {
    lines.push(line);
  }
  return lines.join(lineEnding);
}

/**
 * Calculate approximate size in bytes for a string
 */
export function getStringByteSize(str: string): number {
  return new Blob([str]).size;
}
