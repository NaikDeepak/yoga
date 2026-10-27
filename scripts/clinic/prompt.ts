// Hidden terminal prompt for passwords: nothing is echoed. Passwords never come from argv or env,
// so they can't end up in shell history or process listings.
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

interface PromptIo { input: NodeJS.ReadableStream & { isTTY?: boolean }; output: { write(s: string): unknown } }

/** Rejects when stdin isn't a terminal, or with "No input" on Ctrl-D (input closed before an answer). */
export function askHidden(question: string, io: PromptIo = { input: process.stdin, output: process.stdout }): Promise<string> {
  if (!io.input.isTTY) {
    return Promise.reject(new Error('needs an interactive terminal: passwords are typed, never piped'));
  }
  io.output.write(question);
  // readline echoes typed keys to `output`; give it a sink so nothing reaches the screen.
  const muted = new Writable({ write: (_chunk, _enc, done) => done() });
  const rl = createInterface({ input: io.input, output: muted, terminal: true });
  return new Promise((resolve, reject) => {
    let answered = false;
    rl.on('SIGINT', () => {
      rl.close();
      io.output.write('\n');
      process.exit(130);
    });
    rl.on('close', () => {
      if (answered) return;
      io.output.write('\n');
      reject(new Error('No input'));
    });
    rl.question('', (answer) => {
      answered = true;
      rl.close();
      io.output.write('\n');
      resolve(answer);
    });
  });
}
