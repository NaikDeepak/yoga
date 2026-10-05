'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Link2, MessageCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n/context';
import { formatFullDate, getISTDateString } from '@/lib/dates';
import {
  createExerciseShareLinkAction, createPostureShareLinkAction,
  revokeExerciseShareLinkAction, revokePostureShareLinkAction,
} from '@/actions/share-links';

export interface ActiveShare {
  createdAt: string; // ISO
  expiresAt: string; // ISO
  viewCount: number;
  lastViewedAt: string | null; // ISO
  includePhotos?: boolean; // posture links
}

/** What is being shared: the client's exercise programme, or one posture report. */
export type ShareTarget =
  | { kind: 'exercises'; patientId: string; canShare: boolean }
  | { kind: 'posture'; patientId: string; assessmentId: string; otherReportOn: string | null };

const day = (iso: string) => formatFullDate(getISTDateString(0, new Date(iso)));

/**
 * Send the client a link (exercise programme on the Treatment tab, or a posture report); status,
 * re-share and stop. Posture shares can include photos only when the physio ticks "client agreed".
 */
export function SharePanel({ target, active }: { target: ShareTarget; active: ActiveShare | null }) {
  const tr = useTranslations();
  const t = tr.shareExercises;
  const tp = tr.sharePosture;
  const { patientId } = target;
  const posture = target.kind === 'posture' ? target : null;
  const canShare = target.kind === 'posture' || target.canShare; // exercises need a prescription
  // Start from the live link's choice, so "Share again" doesn't silently drop (or add) photos.
  const [includePhotos, setIncludePhotos] = useState(active?.includePhotos ?? false);
  const [pending, start] = useTransition();
  const [fresh, setFresh] = useState<{ url: string; whatsappUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = () => start(async () => {
    setError(null);
    setCopied(false);
    const r = posture
      ? await createPostureShareLinkAction(posture.assessmentId, includePhotos)
      : await createExerciseShareLinkAction(patientId);
    if (!r.ok) return setError(r.error);
    setFresh({ url: r.url, whatsappUrl: r.whatsappUrl });
  });

  const stop = () => start(async () => {
    setError(null);
    const r = posture ? await revokePostureShareLinkAction(patientId) : await revokeExerciseShareLinkAction(patientId);
    if (!r.ok) return setError(r.error);
    setFresh(null);
  });

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.url);
      setCopied(true);
    } catch {
      setCopied(false); // clipboard blocked: the link is still visible to select by hand
    }
  };

  return (
    <Card className="rounded-2xl print:hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{posture ? tp.hint : t.hint}</p>
        {posture?.otherReportOn && (
          <p className="text-xs text-amber-700">{tp.otherReport.replace('{date}', formatFullDate(posture.otherReportOn))}</p>
        )}

        {active && (
          <div className="rounded-lg bg-primary/5 p-3 text-xs">
            <p>
              {t.status.replace('{created}', day(active.createdAt)).replace('{expires}', day(active.expiresAt))}
              {posture && ` · ${active.includePhotos ? tp.withPhotos : tp.withoutPhotos}`}
            </p>
            <p className="text-muted-foreground">
              {active.lastViewedAt
                ? t.views.replace('{count}', String(active.viewCount)).replace('{last}', day(active.lastViewedAt))
                : t.notOpened}
            </p>
          </div>
        )}

        {fresh && (
          <div className="space-y-2 rounded-lg border border-primary/40 p-3">
            <p className="text-xs font-medium">{t.newLink}</p>
            <input readOnly value={fresh.url} className="w-full rounded border bg-muted px-2 py-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                {copied ? t.copied : t.copy}
              </Button>
              <Button size="sm" asChild>
                <a href={fresh.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {t.whatsapp}
                </a>
              </Button>
            </div>
          </div>
        )}

        {!canShare && <p className="text-xs text-muted-foreground">{t.noExercises}</p>}
        {posture && (
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includePhotos} onChange={(e) => setIncludePhotos(e.target.checked)} />
            {tp.includePhotos}
          </label>
        )}
        {(canShare || active || fresh) && <div className="flex flex-wrap items-center gap-2">
          {canShare && (
            <Button size="sm" variant={active || fresh ? 'outline' : 'default'} onClick={share} disabled={pending}>
              <Link2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {active || fresh ? t.shareAgain : t.share}
            </Button>
          )}
          {/* Stop stays available even if the prescription was emptied while a link is live. */}
          {(active || fresh) && (
            <Button size="sm" variant="ghost" onClick={stop} disabled={pending} className="text-destructive">
              <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t.stop}
            </Button>
          )}
        </div>}
        {(active || fresh) && canShare && <p className="text-[11px] text-muted-foreground">{t.shareAgainHint}</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
