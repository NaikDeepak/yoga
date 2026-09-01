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

  // 2. Keep Supabase Auth & PostgREST DB active — prevent 7-day auto-pause.
  let authOk = true;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl) {
    // 2a. Ping Auth settings
    if (anonKey) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: anonKey },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          authOk = false;
          console.error('Supabase Auth keepalive failed with status:', res.status);
        }
      } catch (authErr) {
        authOk = false;
        console.error('Supabase Auth keepalive failed:', authErr);
      }
    } else {
      authOk = false;
      console.error('Supabase Auth keepalive skipped: missing anon/publishable key env var');
    }

    // 2b. Ping PostgREST with service key to register Postgres schema / DB query activity on Supabase
    if (serviceKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) {
          authOk = false;
          console.error('Supabase PostgREST keepalive failed with status:', res.status);
        }
      } catch (restErr) {
        authOk = false;
        console.error('Supabase PostgREST keepalive failed:', restErr);
      }
    } else {
      authOk = false;
      console.error('Supabase PostgREST keepalive skipped: missing SUPABASE_SERVICE_ROLE_KEY env var');
    }
  } else {
    authOk = false;
    console.error('Supabase keepalive skipped: missing NEXT_PUBLIC_SUPABASE_URL env var');
  }

  const ok = dbOk && authOk;
  return Response.json({ ok, db: dbOk, auth: authOk }, ok ? undefined : { status: 500 });
}
