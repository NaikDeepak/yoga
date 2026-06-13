'use client';

import { useState, useRef } from 'react';
import type { ActionResult } from '@/actions/patients';

export function InlineForm({
  action, children, className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
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
        const result = await action(formData);
        setPending(false);
        if (result && !result.ok) setError(result.error);
        else { setError(null); setSaved(true); ref.current?.reset(); }
      }}
    >
      {error && <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {pending && <p className="mb-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Saving… / सेव्ह होत आहे…</p>}
      {saved && !pending && <p className="mb-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">Saved / जतन झाले ✓</p>}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
