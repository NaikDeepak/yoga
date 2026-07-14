'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { WELLNESS_MESSAGES, wellnessMessageForDay, wellnessShareUrl } from '@/lib/wellness';
import { getISTDateString } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n/context';

export function WellnessTipCard() {
  const t = useTranslations();
  const [index, setIndex] = useState(() =>
    WELLNESS_MESSAGES.indexOf(wellnessMessageForDay(getISTDateString(0))),
  );
  const msg = WELLNESS_MESSAGES[index];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary p-4 text-primary-foreground shadow-sm">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm">{t.nav.healthTip}</h4>
          <button
            type="button"
            onClick={() => setIndex((index + 1) % WELLNESS_MESSAGES.length)}
            aria-label={t.nav.newTip}
            title={t.nav.newTip}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-primary-foreground hover:bg-white/25 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-xs text-primary-foreground/90 leading-relaxed">{msg.en}</p>
        <p className="mt-1.5 text-xs text-primary-foreground/90 leading-relaxed">{msg.mr}</p>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="mt-4 w-full text-xs font-medium bg-white text-primary hover:bg-white/90"
        >
          <a href={wellnessShareUrl(msg)} target="_blank" rel="noopener noreferrer">
            {t.nav.shareOnWhatsapp}
          </a>
        </Button>
      </div>
      {/* Decorative circles */}
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
      <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-black/10 blur-xl" />
    </div>
  );
}
