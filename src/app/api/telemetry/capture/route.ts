import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { recordCaptureCounts } from '@/data/capture-stats';
import { captureBatchSchema } from '@/lib/capture-stats';
import { getISTDateString } from '@/lib/dates';
import { safeErrorMessage } from '@/lib/log';

const MAX_BODY = 10_000; // a full batch is ~5 KB

/**
 * Capture counters from the posture camera screen (backlog E4). A route, not a server action, because the
 * browser sends the batch with `navigator.sendBeacon` as the page closes. Counts only: allow-listed events
 * and photo types, no client, no images.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });

  const body = await req.text();
  if (body.length > MAX_BODY) return NextResponse.json({ error: 'Too large' }, { status: 413 });
  let json: unknown;
  try { json = JSON.parse(body); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const parsed = captureBatchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  try {
    await recordCaptureCounts(getDb(), getISTDateString(0), parsed.data.counts);
  } catch (err) {
    console.error('[telemetry/capture] record failed:', safeErrorMessage(err));
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
