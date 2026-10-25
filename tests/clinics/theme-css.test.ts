import { describe, it, expect } from 'vitest';
import { themeCss } from '@/clinics/theme-css';
import { pawar } from '@/clinics/pawar';

describe('themeCss', () => {
  const css = themeCss(pawar.theme);
  const t = pawar.theme;

  it.each([
    ['--primary', t.primary],
    ['--primary-foreground', t.primaryForeground],
    ['--ring', t.ring],
    ['--background', t.background],
    ['--foreground', t.foreground],
    ['--brand-accent', t.accent],
    ['--brand-accent-text', t.accentText],
  ])('sets %s from the profile', (name, hex) => {
    expect(css).toContain(`${name}:${hex};`);
  });

  it('is a single rule that beats :root in globals.css', () => {
    expect(css.startsWith(':root:root{')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
  });
});
