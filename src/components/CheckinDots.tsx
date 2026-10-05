import type { CheckinDone } from '@/lib/adherence';
import { formatFullDate } from '@/lib/dates';

const DOT: Record<CheckinDone, string> = {
  all: 'bg-primary border-primary',
  some: 'bg-amber-400 border-amber-400',
  none: 'bg-muted-foreground/40 border-muted-foreground/40',
};

/** One dot per day, oldest first: green = all, amber = some, grey = skipped, outline = not logged. */
export function CheckinDots({ days, labels, size = 'md' }: {
  days: { date: string; done: CheckinDone | null }[];
  labels: Record<CheckinDone | 'missing', string>;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-2.5 w-2.5' : 'h-4 w-4';
  return (
    <ol className="flex flex-wrap gap-1">
      {days.map(({ date, done }) => {
        const label = `${formatFullDate(date)}: ${labels[done ?? 'missing']}`;
        return (
          <li key={date} title={label} aria-label={label}
            className={`${dim} rounded-full border ${done ? DOT[done] : 'border-muted-foreground/40 bg-transparent'}`} />
        );
      })}
    </ol>
  );
}
