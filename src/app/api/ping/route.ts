// Daily cron target — keeps the Supabase Auth project active on the free tier.
// Vercel cron calls this once a day (see vercel.json). The route is not
// authenticated so the cron needs no credentials; it just needs to hit a
// Supabase endpoint to register project activity.
export async function GET() {
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  });
  return Response.json({ ok: true });
}
