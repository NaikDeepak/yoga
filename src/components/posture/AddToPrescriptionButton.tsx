'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n/context';
import { addPrescribedExercisesAction } from '@/actions/exercises';

/** Adds library exercises to the client's prescription (keeps what's already there). Hidden in print. */
export function AddToPrescriptionButton({
  patientId,
  exerciseIds,
  label,
}: {
  patientId: string;
  exerciseIds: string[];
  label?: string;
}) {
  const t = useTranslations();
  const pr = t.posture.prescribe;
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if (!exerciseIds.length) return null;

  const add = () => start(async () => {
    const r = await addPrescribedExercisesAction(patientId, exerciseIds);
    if (!r.ok) return setMessage({ ok: false, text: r.error });
    const text = r.added === 0 ? pr.allPresent
      : r.alreadyPrescribed === 0 ? pr.added.replace('{added}', String(r.added))
      : pr.addedSome.replace('{added}', String(r.added)).replace('{already}', String(r.alreadyPrescribed));
    setMessage({ ok: true, text });
  });

  return (
    <div className="mt-2 space-y-1 print:hidden">
      {message?.ok ? (
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-primary">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {message.text}
          <Link href={`/patients/${patientId}?tab=treatment`} className="font-medium underline">{pr.view}</Link>
        </p>
      ) : (
        <Button size="sm" variant="outline" onClick={add} disabled={pending}>
          <ListPlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {label ?? pr.add}
        </Button>
      )}
      {message && !message.ok && <p role="alert" className="text-xs text-destructive">{message.text}</p>}
    </div>
  );
}
