'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell, Tooltip } from 'recharts';

interface WeeklyVisitsChartProps {
  data: { date: string; count: number; isToday?: boolean }[];
}

export function WeeklyVisitsChart({ data }: WeeklyVisitsChartProps) {
  const maxCount = Math.max(...data.map(d => d.count));
  // Ensure the chart has a reasonable scale even if all upcoming days are empty
  const yDomainMax = Math.max(5, maxCount * 1.1);
  // Calculate a proportional small height for empty bars to render the patterned nub
  const emptyBarHeight = yDomainMax * 0.08;

  // Format data for Recharts
  const chartData = data.map((d) => {
    // Manually parse YYYY-MM-DD into a local date object to avoid UTC timezone shifts
    const [year, month, day] = d.date.substring(0, 10).split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
    const isToday = d.isToday ?? (d.date === new Date().toISOString().split('T')[0]);

    return {
      name: dayLabel,
      fullDate: d.date,
      count: d.count,
      isToday,
      // Provide a small height for empty days so the pattern is visible
      displayCount: d.count === 0 ? emptyBarHeight : d.count,
      isEmpty: d.count === 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barSize={32}>
        <defs>
          <pattern id="diagonal-stripe" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <rect width="4" height="8" transform="translate(0,0)" fill="color-mix(in srgb, var(--muted-foreground) 20%, transparent)" />
          </pattern>
        </defs>
        <YAxis domain={[0, yDomainMax]} hide />
        <XAxis
          dataKey="fullDate"
          axisLine={false}
          tickLine={false}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12, fontWeight: 500 }}
          dy={10}
          tickFormatter={(value) => {
            const [year, month, day] = value.substring(0, 10).split('-').map(Number);
            const dateObj = new Date(year, month - 1, day);
            return dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
          }}
        />
        <Tooltip
          cursor={{ fill: 'var(--accent)', radius: 10 }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-background p-2 shadow-sm text-xs">
                  <div className="font-semibold">{data.fullDate}</div>
                  <div className="text-muted-foreground">{data.count} scheduled visits</div>
                </div>
              );
            }
            return null;
          }}
        />
        <Bar dataKey="displayCount" radius={[20, 20, 20, 20]}>
          {chartData.map((entry, index) => {
            const fill = entry.isEmpty
              ? "url(#diagonal-stripe)"
              : (entry.isToday ? "var(--primary)" : "color-mix(in srgb, var(--primary) 70%, transparent)");

            return (
              <Cell
                key={`cell-${index}`}
                fill={fill}
                stroke={entry.isEmpty ? "var(--border)" : "none"}
                strokeWidth={entry.isEmpty ? 1.5 : 0}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
