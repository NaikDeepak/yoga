import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('robots.txt', () => {
  it('keeps every crawler out — the app holds client health records', () => {
    expect(robots().rules).toEqual({ userAgent: '*', disallow: '/' });
  });
});
