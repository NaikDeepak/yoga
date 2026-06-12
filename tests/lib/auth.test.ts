import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireUser } from '@/lib/auth';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

beforeEach(() => vi.clearAllMocks());

describe('requireUser', () => {
  it('returns the user when a session exists', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'admin' } } });
    expect(await requireUser()).toEqual({ id: 'admin' });
  });
  it('redirects to /login when there is no session', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requireUser()).rejects.toThrow('REDIRECT:/login');
  });
});
