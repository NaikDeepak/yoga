import { getDb } from '@/db/client';
import { sql } from 'drizzle-orm';
import { safeErrorMessage } from '@/lib/log';
import { loginProvider } from '@/lib/login-provider';

// Daily cron target. Keeps the production database (Neon) warm and keeps the Supabase project from
// auto-pausing (free tier pauses after 7 days without database activity) whenever NEXT_PUBLIC_SUPABASE_URL
// is set, whichever login provider is active: "roll back to Supabase" must keep working until PR-H retires
// Supabase. With LOGIN_PROVIDER=neon and no Supabase env, there is nothing to ping. Data is on Neon, files on R2.
// Vercel cron calls this once a day (see vercel.json) and automatically sends
// Authorization: Bearer <CRON_SECRET>; the GitHub keepalive workflow sends the same secret.
// Fails closed: without CRON_SECRET set, every call is refused.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  // 1. Keep the app database (Neon) warm
  let dbOk = true;
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
  } catch (dbErr) {
    dbOk = false;
    console.error('Database keepalive query failed:', safeErrorMessage(dbErr));
  }

  // 2. Keep the Supabase login project active — prevent its 7-day auto-pause. Only while it is the login.
  let authOk = true;
  const supabaseLogin = loginProvider() === 'supabase';
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
        console.error('Supabase Auth keepalive failed:', safeErrorMessage(authErr));
      }
    } else {
      authOk = false;
      console.error('Supabase Auth keepalive skipped: missing anon/publishable key env var');
    }

    // 2b. PostgREST call = database activity on the Supabase project, which is what the pause timer counts
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
        console.error('Supabase PostgREST keepalive failed:', safeErrorMessage(restErr));
      }
    } else {
      authOk = false;
      console.error('Supabase PostgREST keepalive skipped: missing SUPABASE_SERVICE_ROLE_KEY env var');
    }
  } else if (supabaseLogin) {
    authOk = false;
    console.error('Supabase keepalive skipped: missing NEXT_PUBLIC_SUPABASE_URL env var');
  }

  const ok = dbOk && authOk;
  return Response.json({ ok, db: dbOk, auth: authOk }, ok ? undefined : { status: 500 });
}
