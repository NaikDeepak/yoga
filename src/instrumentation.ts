export async function register() {
  // The literal NEXT_RUNTIME check lets webpack drop this import (and its
  // node:fs dependencies) from the edge bundle.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initLocalMock } = await import('./instrumentation-node');
    await initLocalMock();
  }
}
