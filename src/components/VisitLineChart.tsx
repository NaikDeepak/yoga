'use client';

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export function VisitLineChart({
  data,
  color,
  unit,
}: {
  data: { visitDate: string; value: number | null }[]; // null = no reading that day (gap, line bridges it)
  color: string;
  unit: string;
}) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="visitDate" fontSize={11} />
        <YAxis fontSize={11} />
        <Tooltip
          formatter={(value) => [unit ? `${value} ${unit}` : String(value), '']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          connectNulls
          dot={(props: { cx?: number; cy?: number; index?: number; value?: number | null }) =>
            props.value == null || props.cy == null
              ? <g key={props.index} />
              : <circle key={props.index} cx={props.cx} cy={props.cy} r={4} fill={color} />}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
