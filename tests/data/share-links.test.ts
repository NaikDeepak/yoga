import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../helpers/db';
import { createPatient } from '@/data/patients';
import {
  activeShareLink, createShareLink, recordShareView, resolveShareLink, revokeShareLinks,
} from '@/data/share-links';
import { patients, shareLinks } from '@/db/schema';
import { hashShareToken } from '@/lib/share-token';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;
const now = new Date('2026-10-05T10:00:00Z');
const later = (days: number) => new Date(now.getTime() + days * 86_400_000);

beforeEach(async () => {
  db = await createTestDb();
  patientId = (await createPatient(db, { fullName: 'Asha Kulkarni', mobile: '9876543210' })).id;
});

describe('createShareLink', () => {
  it('stores only the token hash, with a 90-day expiry', async () => {
    const { token, link } = await createShareLink(db, patientId, 'exercises', now);
    const [row] = await db.select().from(shareLinks);
    expect(row.tokenHash).toBe(hashShareToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(link).toMatchObject({ patientId, kind: 'exercises', viewCount: 0, revokedAt: null });
    expect(link.expiresAt.toISOString()).toBe('2027-01-03T10:00:00.000Z');
  });

  it('revokes the previous link of the same kind (one active link per client)', async () => {
    const first = await createShareLink(db, patientId, 'exercises', now);
    const second = await createShareLink(db, patientId, 'exercises', later(1));
    expect(await resolveShareLink(db, first.token, 'exercises', later(1))).toBeNull();
    expect((await resolveShareLink(db, second.token, 'exercises', later(1)))?.id).toBe(second.link.id);
  });

  it("leaves other clients' links alone", async () => {
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    const other = await createShareLink(db, otherId, 'exercises', now);
    await createShareLink(db, patientId, 'exercises', now);
    expect(await resolveShareLink(db, other.token, 'exercises', now)).not.toBeNull();
  });
});

describe('resolveShareLink', () => {
  it('returns the link for a valid token', async () => {
    const { token, link } = await createShareLink(db, patientId, 'exercises', now);
    expect(await resolveShareLink(db, token, 'exercises', later(10))).toMatchObject({ id: link.id, patientId });
  });

  it('is null for unknown, expired or revoked tokens', async () => {
    const { token } = await createShareLink(db, patientId, 'exercises', now);
    expect(await resolveShareLink(db, 'not-a-real-token', 'exercises', now)).toBeNull();
    expect(await resolveShareLink(db, token, 'exercises', later(90))).toBeNull();
    await revokeShareLinks(db, patientId, 'exercises', later(1));
    expect(await resolveShareLink(db, token, 'exercises', later(2))).toBeNull();
  });
});

describe('activeShareLink', () => {
  it('is the current link, or null once revoked or expired', async () => {
    expect(await activeShareLink(db, patientId, 'exercises', now)).toBeNull();
    const { link } = await createShareLink(db, patientId, 'exercises', now);
    expect((await activeShareLink(db, patientId, 'exercises', now))?.id).toBe(link.id);
    expect(await activeShareLink(db, patientId, 'exercises', later(91))).toBeNull();
    await revokeShareLinks(db, patientId, 'exercises', later(1));
    expect(await activeShareLink(db, patientId, 'exercises', later(1))).toBeNull();
  });
});

describe('recordShareView', () => {
  it('counts views and remembers the last one', async () => {
    const { link } = await createShareLink(db, patientId, 'exercises', now);
    await recordShareView(db, link.id, later(1));
    await recordShareView(db, link.id, later(2));
    const [row] = await db.select().from(shareLinks);
    expect(row.viewCount).toBe(2);
    expect(row.lastViewedAt?.toISOString()).toBe(later(2).toISOString());
  });
});

it('links disappear when the client is deleted', async () => {
  await createShareLink(db, patientId, 'exercises', now);
  await db.delete(patients).where(eq(patients.id, patientId));
  expect(await db.select().from(shareLinks)).toHaveLength(0);
});
