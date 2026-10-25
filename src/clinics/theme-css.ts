import type { ClinicProfile } from './types';

/** CSS overriding the on-screen colour variables from globals.css. `:root:root` outranks the plain
 *  `:root` there whatever the stylesheet order. Input is schema-validated hex, so it is safe to inject. */
export function themeCss(theme: ClinicProfile['theme']): string {
  return (
    ':root:root{' +
    `--primary:${theme.primary};` +
    `--primary-foreground:${theme.primaryForeground};` +
    `--ring:${theme.ring};` +
    `--background:${theme.background};` +
    `--foreground:${theme.foreground};` +
    `--brand-accent:${theme.accent};` +
    `--brand-accent-text:${theme.accentText};` +
    '}'
  );
}
