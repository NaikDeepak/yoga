// Daily cron target — keeps the Supabase Auth project active on the free tier.
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

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    return Response.json({ ok: false }, { status: 500 });
  }
  return Response.json({ ok: true });
}
