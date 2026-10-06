'use client';

import { useState, useTransition } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recordNudgeAction } from '@/actions/share-links';

/**
 * Records the nudge, then opens the WhatsApp message (spec: "records, then opens WhatsApp"). A blank tab is
 * opened inside the tap so browsers don't block it, and pointed at WhatsApp once the save succeeds; on a
 * failed save it closes and the error shows, so the "nudged today" guard never silently fails.
 */
export function NudgeButton({ patientId, href, label, failedText, openText }: {
  patientId: string;
  href: string;
  label: string;
  /** Contains `{error}`. */
  failedText: string;
  /** Link shown when the browser blocked the new tab (the nudge is already saved). */
  openText: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const nudge = () => {
    setError(null);
    setBlocked(false);
    const tab = window.open('', '_blank');
    start(async () => {
      let r: Awaited<ReturnType<typeof recordNudgeAction>>;
      try {
        r = await recordNudgeAction(patientId);
      } catch {
        r = { ok: false, error: 'network error' };
      }
      if (!r.ok) {
        tab?.close();
        setError(failedText.replace('{error}', r.error));
        return;
      }
      if (tab) tab.location.href = href;
      else setBlocked(true); // pop-up blocked: offer a real link (a direct tap always opens), stay on the dashboard
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end">
      <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={nudge} disabled={pending}>
        <MessageCircle className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </Button>
      {blocked && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-1 text-[11px] font-medium text-primary underline">{openText}</a>
      )}
      {error && <p role="alert" className="mt-1 max-w-48 text-right text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
