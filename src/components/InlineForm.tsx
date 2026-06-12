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
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      className={className}
      action={async (formData) => {
        const result = await action(formData);
        if (result && !result.ok) setError(result.error);
        else { setError(null); ref.current?.reset(); }
      }}
    >
      {error && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      {children}
    </form>
  );
}
