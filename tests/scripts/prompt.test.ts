import { describe, it, expect } from 'vitest';
import { PassThrough } from 'node:stream';
import { askHidden } from '../../scripts/clinic/prompt';

function io(tty = true) {
  const input = Object.assign(new PassThrough(), { isTTY: tty });
  const written: string[] = [];
  return { input, written, output: { write: (s: string) => written.push(s) } };
}

describe('askHidden', () => {
  it('refuses when input is not a terminal', async () => {
    const t = io(false);
    await expect(askHidden('Q: ', t)).rejects.toThrow(/interactive terminal/);
  });

  it('resolves the typed answer without echoing it', async () => {
    const t = io();
    const answer = askHidden('Q: ', t);
    t.input.write('s3cret-pw\r');
    expect(await answer).toBe('s3cret-pw');
    expect(t.written.join('')).not.toContain('s3cret');
  });

  it('rejects with "No input" when input closes first (Ctrl-D)', async () => {
    const t = io();
    const answer = askHidden('Q: ', t);
    t.input.end();
    await expect(answer).rejects.toThrow('No input');
  });
});
