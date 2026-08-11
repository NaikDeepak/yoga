import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('PWA manifest', () => {
  const m = manifest();

  it('has app identity', () => {
    expect(m.name).toBe('Pawar Yoga Therapy');
    expect(m.short_name).toBe('PYT');
    expect(m.description).toBe('Patient management for Pawar Yoga Therapy');
  });

  it('launches standalone from root', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
  });

  it('sets theme and background colors', () => {
    expect(m.background_color).toBe('#F9F6F0');
    expect(m.theme_color).toBe('#3B6954');
  });

  it('declares 192, 512, and maskable icons', () => {
    const icons = m.icons ?? [];
    expect(icons).toContainEqual({
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
    });
    expect(icons).toContainEqual({
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
    });
    expect(icons).toContainEqual({
      src: '/icons/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    });
  });
});
