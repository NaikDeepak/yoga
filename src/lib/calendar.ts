export type CalendarDay = {
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
};

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function buildMonthGrid(year: number, month: number, todayISO: string): CalendarDay[][] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalWeeks = Math.max(5, Math.ceil((startWeekday + daysInMonth) / 7));
  const totalCells = totalWeeks * 7;

  const days: CalendarDay[] = [];
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(Date.UTC(year, month - 1, 1 + (i - startWeekday)));
    const dateStr = formatDate(cellDate);
    days.push({
      date: dateStr,
      isCurrentMonth: cellDate.getUTCFullYear() === year && cellDate.getUTCMonth() === month - 1,
      isToday: dateStr === todayISO,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}
