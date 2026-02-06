/**
 * Verification utility for mock system
 * This helps debug whether mocks are being enabled when they shouldn't be
 */

export function verifyMockStatus() {
  const isBrowser = typeof window !== 'undefined';
  const hasTauriInternals = isBrowser && '__TAURI_INTERNALS__' in window;
  const hasTauri = isBrowser && '__TAURI__' in window;
  const isTauri = hasTauriInternals || hasTauri;

  let enableMocksFlag: boolean | string = 'undefined';
  try {
    enableMocksFlag = (globalThis as any).__ENABLE_MOCKS__ ?? 'undefined';
  } catch {
    enableMocksFlag = 'error';
  }

  const status = {
    environment: isTauri ? 'Tauri' : 'Browser',
    isTauri,
    hasTauriInternals,
    hasTauri,
    enableMocksFlag,
    shouldEnableMocks: !isTauri && enableMocksFlag === true,
  };

  console.table(status);

  if (isTauri && enableMocksFlag === true) {
    console.error('❌ ERROR: Mocks are enabled in Tauri environment! This should never happen.');
    console.error('This indicates a build configuration issue.');
  } else if (!isTauri && enableMocksFlag === false) {
    console.warn('⚠️  WARNING: Mocks are disabled in browser environment. Features may not work.');
  } else {
    console.log('✅ Mock configuration is correct for this environment');
  }

  return status;
}
