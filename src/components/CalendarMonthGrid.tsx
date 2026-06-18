'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, shiftMonth } from '@/lib/calendar';
import type { FollowUp } from '@/data/visits';
import { useTranslations } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type CalendarMonthGridProps = {
  year: number;
  month: number;
  todayISO: string;
  followUpsByDate: Record<string, FollowUp[]>;
};

export function CalendarMonthGrid({ year, month, todayISO, followUpsByDate }: CalendarMonthGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const weeks = buildMonthGrid(year, month, todayISO);
  const selectedFollowUps = selectedDate ? followUpsByDate[selectedDate] ?? [] : [];

  function navigateToMonth(targetYear: number, targetMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', `${targetYear}-${String(targetMonth).padStart(2, '0')}`);
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToday() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('month');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.calendar.months[month - 1]} {year}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>{t.calendar.today}</Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.calendar.prevMonth}
            onClick={() => {
              const prev = shiftMonth(year, month, -1);
              navigateToMonth(prev.year, prev.month);
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t.calendar.nextMonth}
            onClick={() => {
              const next = shiftMonth(year, month, 1);
              navigateToMonth(next.year, next.month);
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground uppercase">
        {t.calendar.weekdays.map((d) => <div key={d}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const count = followUpsByDate[day.date]?.length ?? 0;
          return (
            <button
              key={day.date}
              type="button"
              disabled={count === 0}
              onClick={() => setSelectedDate(day.date)}
              className={cn(
                'relative flex h-20 flex-col items-center justify-start rounded-lg border border-border p-2 text-sm transition-colors',
                day.isCurrentMonth ? 'bg-card text-foreground' : 'bg-muted/30 text-muted-foreground',
                day.isToday && 'border-primary',
                count > 0 && 'hover:bg-accent/50 cursor-pointer',
                count === 0 && 'cursor-default',
              )}
            >
              <span className={cn('text-xs', day.isToday && 'font-bold text-primary')}>
                {Number(day.date.slice(8, 10))}
              </span>
              {count > 0 && (
                <span className="mt-1 min-w-[20px] rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={selectedDate !== null} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate} — {t.calendar.patientsDue.replace('{count}', String(selectedFollowUps.length))}
            </DialogTitle>
          </DialogHeader>
          {selectedFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.calendar.noFollowUps}</p>
          ) : (
            <ul className="space-y-2">
              {selectedFollowUps.map((f) => (
                <li key={f.patientId} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <Link href={`/patients/${f.patientId}`} className="text-sm font-medium hover:text-primary transition-colors">
                    {f.fullName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{f.patientCode}</span>
                    <span className="text-xs text-muted-foreground">{f.mobile}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
