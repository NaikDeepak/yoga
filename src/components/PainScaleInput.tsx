'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

function selectedColor(n: number): string {
  if (n <= 3) return 'bg-primary text-primary-foreground border-primary';
  if (n <= 6) return 'bg-yellow-500 text-white border-yellow-500';
  return 'bg-destructive text-white border-destructive';
}

/**
 * Segmented 1–10 pain picker: bigger touch targets than a number spinner.
 * Submits via a hidden input; tapping the selected value clears it (pain is optional).
 */
export function PainScaleInput({
  name,
  defaultValue,
  ariaLabel,
}: {
  name: string;
  defaultValue?: number | null;
  ariaLabel: string;
}) {
  const [value, setValue] = useState<number | null>(defaultValue ?? null);
  const ref = useRef<HTMLInputElement>(null);

  // State, not a form field, so form.reset() (InlineForm after a save) needs telling: back to the starting value.
  useEffect(() => {
    const form = ref.current?.form;
    const restore = () => setValue(defaultValue ?? null);
    form?.addEventListener('reset', restore);
    return () => form?.removeEventListener('reset', restore);
  }, [defaultValue]);

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      <input ref={ref} type="hidden" name={name} value={value ?? ''} />
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => setValue(value === n ? null : n)}
          className={cn(
            'h-9 w-9 rounded-full border text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value === n
              ? cn(selectedColor(n), 'hover:opacity-90')
              : 'bg-background text-foreground border-border hover:bg-muted',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
