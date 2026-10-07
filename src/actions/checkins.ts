'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { saveCheckin } from '@/data/checkins';
import { getPrescribedExercises } from '@/data/exercises';
import { resolveShareLink } from '@/data/share-links';
import { checkinDay } from '@/lib/adherence';
import { checkinSchema } from '@/lib/validation';
import { safeErrorMessage } from '@/lib/log';

/**
 * Daily check-in from the client's public exercise page. The one mutation without `requireUser()`:
 * the share-link token is the key, the client comes from the server and the date is the server's (IST)
 * today — or the day the form showed, if saved within an hour after midnight. Input is two
 * enums (no free text), and there's one row per client per day. Always redirects back to the page;
 * on errors with the form open (edit=1), so the message shows even when today already has an entry.
 */
export async function saveCheckinAction(token: string, lang: string, formData: FormData): Promise<never> {
  const page = `/s/${encodeURIComponent(token)}`;
  const query = `?lang=${lang === 'mr' ? 'mr' : 'en'}`;
  if (token.length > 100) redirect(`/s/x${query}`); // real tokens are 43 characters
  const db = getDb();
  const link = await resolveShareLink(db, token, 'exercises', new Date());
  if (!link) redirect(`${page}${query}`); // the page shows the same "link expired" screen
  // The page hides the form for an empty prescription; refuse direct posts too.
  if (!(await getPrescribedExercises(db, link.patientId)).length) redirect(`${page}${query}`);

  const parsed = checkinSchema.safeParse({
    done: formData.get('done'), pain: formData.get('pain') ?? undefined, day: formData.get('day') ?? undefined,
  });
  if (!parsed.success) redirect(`${page}${query}&edit=1&error=1`);

  try {
    await saveCheckin(db, link, parsed.data, checkinDay(parsed.data.day ?? null, new Date()));
  } catch (error) {
    console.error('Failed to save check-in:', safeErrorMessage(error));
    redirect(`${page}${query}&edit=1&error=1`);
  }
  revalidatePath(`/patients/${link.patientId}`);
  redirect(`${page}${query}`);
}
