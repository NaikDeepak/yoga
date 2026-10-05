import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { patients, shareLinks, type ShareLinkKind, type ShareLinkRow } from '@/db/schema';
import type { Db } from '@/db/types';
import { hashShareToken, newShareToken, shareLinkExpiry } from '@/lib/share-token';

const live = (now: Date) => and(isNull(shareLinks.revokedAt), gt(shareLinks.expiresAt, now));

/**
 * New link for a client; the previous one of the same kind stops working (only the hash is stored,
 * so an old link can't be shown again — re-sharing means a new link). The token is returned once.
 */
export async function createShareLink(
  db: Db,
  patientId: string,
  kind: ShareLinkKind,
  now: Date,
): Promise<{ token: string; link: ShareLinkRow }> {
  const { token, hash } = newShareToken();
  const link = await db.transaction(async (tx) => {
    // Lock the client so overlapping "Share again" requests run one after the other; each then revokes
    // the link the previous one created (the unique index on live links backs this up).
    await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, patientId)).for('update');
    await tx.update(shareLinks).set({ revokedAt: now })
      .where(and(eq(shareLinks.patientId, patientId), eq(shareLinks.kind, kind), isNull(shareLinks.revokedAt)));
    const [row] = await tx.insert(shareLinks)
      .values({ patientId, kind, tokenHash: hash, expiresAt: shareLinkExpiry(now), createdAt: now })
      .returning();
    return row;
  });
  return { token, link };
}

/** The live link for a token, or null — unknown, expired and revoked look the same to the caller. */
export async function resolveShareLink(db: Db, token: string, kind: ShareLinkKind, now: Date): Promise<ShareLinkRow | null> {
  const [row] = await db.select().from(shareLinks)
    .where(and(eq(shareLinks.tokenHash, hashShareToken(token)), eq(shareLinks.kind, kind), live(now)));
  return row ?? null;
}

/** The client's current link of a kind (for the physio's status line), or null. */
export async function activeShareLink(db: Db, patientId: string, kind: ShareLinkKind, now: Date): Promise<ShareLinkRow | null> {
  const [row] = await db.select().from(shareLinks)
    .where(and(eq(shareLinks.patientId, patientId), eq(shareLinks.kind, kind), live(now)))
    .orderBy(desc(shareLinks.createdAt))
    .limit(1);
  return row ?? null;
}

export async function revokeShareLinks(db: Db, patientId: string, kind: ShareLinkKind, now: Date): Promise<void> {
  await db.update(shareLinks).set({ revokedAt: now })
    .where(and(eq(shareLinks.patientId, patientId), eq(shareLinks.kind, kind), isNull(shareLinks.revokedAt)));
}

/** Views within this long of the previous one are the same visit (reloads, the browser re-requesting the page). */
export const SHARE_VISIT_GAP_MINUTES = 30;

/** Counts a visit (at most one per 30-minute sitting) and always updates the last-opened time. */
export async function recordShareView(db: Db, id: string, now: Date): Promise<void> {
  // ISO string cast to `timestamp` (no tz), as drizzle writes these columns — no driver/session-timezone guessing.
  const sameVisitAfter = new Date(now.getTime() - SHARE_VISIT_GAP_MINUTES * 60_000).toISOString();
  await db.update(shareLinks)
    .set({
      viewCount: sql`${shareLinks.viewCount} + case
        when ${shareLinks.lastViewedAt} is not null and ${shareLinks.lastViewedAt} > ${sameVisitAfter}::timestamp then 0 else 1 end`,
      lastViewedAt: now,
    })
    .where(eq(shareLinks.id, id));
}
