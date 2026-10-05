'use client';

import { useState, useTransition } from 'react';
import { Check, Copy, Link2, MessageCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/lib/i18n/context';
import { formatFullDate, getISTDateString } from '@/lib/dates';
import { createExerciseShareLinkAction, revokeExerciseShareLinkAction } from '@/actions/share-links';

export interface ActiveShare {
  createdAt: string; // ISO
  expiresAt: string; // ISO
  viewCount: number;
  lastViewedAt: string | null; // ISO
}

const day = (iso: string) => formatFullDate(getISTDateString(0, new Date(iso)));

/** Treatment tab: send the client a link to their home exercises; status, re-share and stop. */
export function ShareExercisesPanel({ patientId, active, hasExercises }: {
  patientId: string;
  active: ActiveShare | null;
  hasExercises: boolean;
}) {
  const t = useTranslations().shareExercises;
  const [pending, start] = useTransition();
  const [fresh, setFresh] = useState<{ url: string; whatsappUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = () => start(async () => {
    setError(null);
    setCopied(false);
    const r = await createExerciseShareLinkAction(patientId);
    if (!r.ok) return setError(r.error);
    setFresh({ url: r.url, whatsappUrl: r.whatsappUrl });
  });

  const stop = () => start(async () => {
    setError(null);
    const r = await revokeExerciseShareLinkAction(patientId);
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
        <p className="text-muted-foreground">{t.hint}</p>

        {active && (
          <div className="rounded-lg bg-primary/5 p-3 text-xs">
            <p>{t.status.replace('{created}', day(active.createdAt)).replace('{expires}', day(active.expiresAt))}</p>
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

        {!hasExercises ? (
          <p className="text-xs text-muted-foreground">{t.noExercises}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={active || fresh ? 'outline' : 'default'} onClick={share} disabled={pending}>
              <Link2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {active || fresh ? t.shareAgain : t.share}
            </Button>
            {(active || fresh) && (
              <Button size="sm" variant="ghost" onClick={stop} disabled={pending} className="text-destructive">
                <XCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {t.stop}
              </Button>
            )}
          </div>
        )}
        {(active || fresh) && hasExercises && <p className="text-[11px] text-muted-foreground">{t.shareAgainHint}</p>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
