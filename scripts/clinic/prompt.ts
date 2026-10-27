// Hidden terminal prompt for passwords: nothing is echoed. Passwords never come from argv or env,
// so they can't end up in shell history or process listings.
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

export function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return Promise.reject(new Error('needs an interactive terminal: passwords are typed, never piped'));
  }
  process.stdout.write(question);
  // readline echoes typed keys to `output`; give it a sink so nothing reaches the screen.
  const muted = new Writable({ write: (_chunk, _enc, done) => done() });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    rl.on('SIGINT', () => {
      rl.close();
      process.stdout.write('\n');
      process.exit(130);
    });
    rl.question('', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}
