'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useTranslations } from '@/lib/i18n/context';

export function AilmentBarChart({ data }: { data: { problem: string; count: number }[] }) {
  const t = useTranslations();
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          dataKey="count"
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500 }}
        />
        <YAxis
          type="category"
          dataKey="problem"
          width={130}
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500 }}
        />
        <Tooltip
          cursor={{ fill: 'var(--accent)', radius: 10 }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const entry = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-background p-2 shadow-sm text-xs">
                  <div className="font-semibold">{entry.problem}</div>
                  <div className="text-muted-foreground">{entry.count} {t.dashboard.patientsLabel}</div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="count" radius={[0, 20, 20, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={
                entry.count === maxCount
                  ? 'var(--primary)'
                  : 'color-mix(in srgb, var(--primary) 70%, transparent)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
