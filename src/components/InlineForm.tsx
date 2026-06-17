'use client';

import { useState, useRef } from 'react';
import type { ActionResult } from '@/actions/patients';
import { useTranslations } from '@/lib/i18n/context';

export function InlineForm({
  action, children, className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations();
  const genericError = t.inlineForm.genericError;
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (formData) => {
        setPending(true);
        setSaved(false);
        try {
          const result = await action(formData);
          if (result && !result.ok) setError(result.error);
          else { setError(null); setSaved(true); ref.current?.reset(); }
        } catch (err) {
          // Re-throw Next.js redirect/notFound errors so the framework handles them
          if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || err.message === 'NEXT_NOT_FOUND')) {
            throw err;
          }
          setError(genericError);
        } finally {
          setPending(false);
        }
      }}
    >
      {error && <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {pending && <p className="mb-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t.inlineForm.submitting}</p>}
      {saved && !pending && <p className="mb-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{t.inlineForm.saved}</p>}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
