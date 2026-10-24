import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';

describe('robots.txt', () => {
  it('blocks nothing, so crawlers can fetch a leaked share link and obey its noindex header', () => {
    expect(robots().rules).toEqual({ userAgent: '*', allow: '/' });
  });
});
