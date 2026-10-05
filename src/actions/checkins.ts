'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { saveCheckin } from '@/data/checkins';
import { resolveShareLink } from '@/data/share-links';
import { getISTDateString } from '@/lib/dates';
import { checkinSchema } from '@/lib/validation';

/**
 * Daily check-in from the client's public exercise page. The one mutation without `requireUser()`:
 * the share-link token is the key, the client and the date come from the server, input is two
 * enums (no free text), and there's one row per client per day. Always redirects back to the page.
 */
export async function saveCheckinAction(token: string, lang: string, formData: FormData): Promise<never> {
  const page = `/s/${encodeURIComponent(token)}`;
  const query = `?lang=${lang === 'mr' ? 'mr' : 'en'}`;
  const db = getDb();
  const link = await resolveShareLink(db, token, 'exercises', new Date());
  if (!link) redirect(page); // the page shows the same "link expired" screen

  const parsed = checkinSchema.safeParse({ done: formData.get('done'), pain: formData.get('pain') ?? undefined });
  if (!parsed.success) redirect(`${page}${query}&error=1`);

  try {
    await saveCheckin(db, link, parsed.data, getISTDateString());
  } catch (error) {
    console.error('Failed to save check-in:', error instanceof Error ? error.message : String(error));
    redirect(`${page}${query}&error=1`);
  }
  revalidatePath(`/patients/${link.patientId}`);
  redirect(`${page}${query}`);
}
