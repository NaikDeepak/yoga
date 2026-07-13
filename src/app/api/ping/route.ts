import { getDb } from '@/db/client';
import { sql } from 'drizzle-orm';

// Daily cron target — keeps the Supabase Auth project and Database active/warm on the free tier.
// Vercel cron calls this once a day (see vercel.json) and automatically sends
// Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set in the project.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false }, { status: 401 });
    }
  }

  // 1. Keep Database active & prevent cold starts / pauses
  let dbOk = true;
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  } catch (dbErr) {
    dbOk = false;
    console.error('Database keepalive query failed:', dbErr);
  }

  // 2. Keep Supabase Auth project active — attempted even if the DB ping failed,
  // so one outage doesn't stop the other keepalive.
  let authOk = true;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      authOk = false;
      console.error('Auth keepalive failed with status:', res.status);
    }
  } catch (authErr) {
    authOk = false;
    console.error('Auth keepalive failed:', authErr);
  }

  const ok = dbOk && authOk;
  return Response.json({ ok, db: dbOk, auth: authOk }, ok ? undefined : { status: 500 });
}
