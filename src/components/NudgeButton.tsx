'use client';

import { useTransition } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordNudgeAction } from '@/actions/share-links';

/** Opens the WhatsApp nudge and records when it was sent (the dashboard then shows "Nudged today"). */
export function NudgeButton({ patientId, href, label }: { patientId: string; href: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <Button asChild size="sm" variant="outline" className="h-8 shrink-0 rounded-full px-3 text-xs" aria-busy={pending}>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => start(async () => { await recordNudgeAction(patientId); })}>
        <MessageCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}
