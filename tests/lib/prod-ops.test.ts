import { describe, it, expect } from 'vitest';
import { alreadyLive, deploymentUrlFromCli, maskDbUrl, pendingMigrations, releaseProblems, smokeFailures } from '@/lib/prod-ops';

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
  it('accepts any of several statuses for a path', () => {
    expect(smokeFailures({ '/api/ping': 401 }, { '/api/ping': [200, 401] })).toEqual([]);
    expect(smokeFailures({ '/api/ping': 500 }, { '/api/ping': [200, 401] })).toEqual(['/api/ping: expected 200 or 401, got 500']);
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

describe('deploymentUrlFromCli', () => {
  it('reads the agent-mode JSON (non-interactive vercel deploy)', () => {
    const out = JSON.stringify({ status: 'ok', deployment: { id: 'dpl_1', url: 'https://yoga-abc123-team.vercel.app' }, message: 'ready' });
    expect(deploymentUrlFromCli(out)).toBe('https://yoga-abc123-team.vercel.app');
  });
  it('reads the plain --format=json output', () => {
    expect(deploymentUrlFromCli('{"id":"dpl_1","url":"https://yoga-x-team.vercel.app"}')).toBe('https://yoga-x-team.vercel.app');
  });
  it('is null for anything else, including a non-Vercel URL', () => {
    expect(deploymentUrlFromCli('Error: something')).toBeNull();
    expect(deploymentUrlFromCli('{"url":"https://evil.example.com"}')).toBeNull();
    expect(deploymentUrlFromCli('{"status":"error"}')).toBeNull();
  });
});

describe('alreadyLive', () => {
  it("recognises Vercel's 409 for promoting the deployment that is already live", () => {
    expect(alreadyLive('Error: The provided deploymentId (dpl_x) is already the current production deployment. (409)')).toBe(true);
  });
  it('treats other promote errors as real failures', () => {
    expect(alreadyLive('Error: Deployment not found (404)')).toBe(false);
    expect(alreadyLive('')).toBe(false);
  });
});
