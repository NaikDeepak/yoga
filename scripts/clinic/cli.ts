// Argument parsing and checks shared by the clinic login scripts. Pure: throws, never exits.
import { parseArgs } from 'node:util';

export interface ClinicArgs { clinic: string; email: string; reset: boolean; site?: string }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseClinicArgs(argv: string[]): ClinicArgs {
  const { values } = parseArgs({
    args: argv,
    options: { clinic: { type: 'string' }, email: { type: 'string' }, reset: { type: 'boolean' }, site: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  });
  if (!values.clinic) throw new Error('--clinic <slug> is required');
  if (!values.email) throw new Error('--email <address> is required');
  const email = values.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Error('--email is not an email address');
  let site: string | undefined;
  if (values.site !== undefined) {
    if (!/^https?:\/\/[^\s/]+/.test(values.site)) throw new Error('--site must be an http(s) URL');
    site = values.site.replace(/\/+$/, '');
  }
  return { clinic: values.clinic, email, reset: values.reset ?? false, site };
}

export function parseMoveArgs(argv: string[]): { from: string; to: string } {
  const { values } = parseArgs({
    args: argv,
    options: { from: { type: 'string' }, to: { type: 'string' } },
    strict: true,
    allowPositionals: false,
  });
  const from = values.from?.trim();
  const to = values.to?.trim();
  if (!from) throw new Error('--from <old user id> is required');
  if (!to) throw new Error('--to <new user id> is required');
  if (from === to) throw new Error('--from and --to must differ');
  return { from, to };
}

export const MIN_PASSWORD_LENGTH = 8; // Better Auth's default minimum

/** Why a new password (typed twice) can't be used, or null. Never repeats the password. */
export function newPasswordProblem(first: string, second: string): string | null {
  if (first.length < MIN_PASSWORD_LENGTH) return `the new password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (first !== second) return 'the two new passwords do not match';
  return null;
}

export type Ask = (question: string) => Promise<string>;
export type Print = (line: string) => void;
