import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import { saveCheckin } from '@/data/checkins';
import { createShareLink, recordNudge, revokeShareLinks } from '@/data/share-links';
import { listQuietClients } from '@/data/quiet-clients';
import type { Db } from '@/db/types';

let db: Db;
const now = new Date('2026-10-10T04:30:00Z'); // 10:00 IST, 10 Oct
const today = '2026-10-10';
const at = (day: string) => new Date(`${day}T04:30:00Z`);

async function client(fullName: string, sharedOn: string | null, checkins: string[] = [], branch?: string) {
  const p = await createPatient(db, { fullName, mobile: '9876543210', ...(branch && { branch }) } as never);
  if (sharedOn) {
    const { link } = await createShareLink(db, p.id, 'exercises', at(sharedOn));
    for (const d of checkins) await saveCheckin(db, { id: link.id, patientId: p.id }, { done: 'all' }, d);
  }
  return p.id;
}
const names = async (opts = {}) => (await listQuietClients(db, today, now, opts)).clients.map((c) => c.fullName);

beforeEach(async () => { db = await createTestDb(); });

describe('listQuietClients', () => {
  it('lists clients 3+ days without a check-in (from the later of last check-in and share day), quietest first', async () => {
    await client('Asha', '2026-10-01', ['2026-10-02', '2026-10-05']); // last 5 Oct → 5 days
    await client('Bina', '2026-10-01', ['2026-10-07']);               // 3 days → quiet
    await client('Chetan', '2026-10-01', ['2026-10-08']);             // 2 days → fine
    await client('Deepa', '2026-10-01', ['2026-10-10']);              // today → fine
    const r = await listQuietClients(db, today, now);
    expect(r.clients.map((c) => [c.fullName, c.quietDays, c.lastCheckin])).toEqual([
      ['Asha', 5, '2026-10-05'], ['Bina', 3, '2026-10-07'],
    ]);
    expect(r.total).toBe(2);
  });

  it('a client who never checked in is listed 3 days after the link was shared', async () => {
    await client('Esha', '2026-10-07');
    await client('Farah', '2026-10-08');
    expect(await names()).toEqual(['Esha']);
    expect((await listQuietClients(db, today, now)).clients[0]).toMatchObject({ quietDays: 3, lastCheckin: null });
  });

  it('a re-shared link restarts the count (old check-ins before the new link do not make them quiet)', async () => {
    const id = await client('Gita', '2026-09-01', ['2026-09-02']);
    await createShareLink(db, id, 'exercises', at('2026-10-09')); // shared again yesterday
    expect(await names()).toEqual([]);
  });

  it('ignores clients without a live exercise link: none, revoked or expired', async () => {
    await client('NoLink', null);
    const revoked = await client('Revoked', '2026-10-01');
    await revokeShareLinks(db, revoked, 'exercises', at('2026-10-02'));
    await client('Expired', '2026-06-01'); // 90-day links: expired by October
    expect(await names()).toEqual([]);
  });

  it('respects the branch filter and the limit, and reports the full total', async () => {
    await client('A1', '2026-10-01', [], 'Manjari BK');
    await client('A2', '2026-10-02', [], 'Manjari BK');
    await client('B1', '2026-10-01', [], 'Kharadi');
    expect((await names({ branch: 'Manjari BK' })).sort()).toEqual(['A1', 'A2']);
    const limited = await listQuietClients(db, today, now, { limit: 1 });
    expect(limited.clients).toHaveLength(1);
    expect(limited.total).toBe(3);
  });

  it('returns when they were last nudged; a new link starts un-nudged', async () => {
    const id = await client('Hema', '2026-10-01');
    expect((await listQuietClients(db, today, now)).clients[0].nudgedAt).toBeNull();
    expect(await recordNudge(db, id, at('2026-10-08'))).toBe(true);
    expect((await listQuietClients(db, today, now)).clients[0].nudgedAt).toEqual(at('2026-10-08'));
    await createShareLink(db, id, 'exercises', at('2026-10-05'));
    await recordNudge(db, id, at('2026-10-09'));
    expect((await listQuietClients(db, today, now)).clients[0].nudgedAt).toEqual(at('2026-10-09'));
  });

  it('recordNudge is false without a live exercise link', async () => {
    const id = await client('Isha', null);
    expect(await recordNudge(db, id, now)).toBe(false);
  });
});
