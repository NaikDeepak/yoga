import { describe, it, expect } from 'vitest';
import { maskDbUrl, pendingMigrations, releaseProblems, smokeFailures } from '@/lib/prod-ops';

const journal = [{ tag: '0000_a', when: 100 }, { tag: '0001_b', when: 200 }, { tag: '0002_c', when: 300 }];

describe('pendingMigrations', () => {
  it('lists journal entries newer than the last applied migration', () => {
    expect(pendingMigrations(journal, 200)).toEqual(['0002_c']);
    expect(pendingMigrations(journal, 300)).toEqual([]);
  });
  it('lists everything on a fresh database', () => {
    expect(pendingMigrations(journal, null)).toEqual(['0000_a', '0001_b', '0002_c']);
  });
});

describe('releaseProblems', () => {
  const ok = { branch: 'main', dirty: false, behind: 0, ahead: 0 };
  it('passes a clean, up-to-date main', () => {
    expect(releaseProblems(ok)).toEqual([]);
  });
  it('explains every reason it refuses', () => {
    expect(releaseProblems({ branch: 'feat/x', dirty: true, behind: 2, ahead: 1 })).toEqual([
      'Not on main (on feat/x) — production only gets merged code.',
      'Uncommitted changes — commit or stash them first.',
      'main is 2 commit(s) behind origin/main — run git pull.',
      'main has 1 unpushed commit(s) — push (via a PR) first.',
    ]);
  });
});

describe('smokeFailures', () => {
  it('lists paths whose status differs from what was expected', () => {
    expect(smokeFailures({ '/login': 200, '/api/ping': 500, '/s/x': 404 }, { '/login': 200, '/api/ping': 200, '/s/x': 404 }))
      .toEqual(['/api/ping: expected 200, got 500']);
  });
  it('treats a missing response as a failure', () => {
    expect(smokeFailures({}, { '/login': 200 })).toEqual(['/login: expected 200, got no response']);
  });
});

describe('maskDbUrl', () => {
  it('shows only the provider-level host, never credentials', () => {
    const masked = maskDbUrl('postgresql://neondb_owner:s3cret@ep-cool-123-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require');
    expect(masked).toBe('***.ap-southeast-1.aws.neon.tech');
    expect(masked).not.toContain('s3cret');
  });
  it('copes with garbage', () => {
    expect(maskDbUrl('not a url')).toBe('(invalid URL)');
  });
});
