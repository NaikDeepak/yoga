'use client';

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

export function AilmentBarChart({ data }: { data: { problem: string; count: number }[] }) {
  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ left: 8, right: 24, top: 0, bottom: 0 }}
      >
        <XAxis type="number" dataKey="count" allowDecimals={false} fontSize={12} />
        <YAxis type="category" dataKey="problem" width={130} fontSize={12} />
        <Tooltip formatter={(value) => [value, 'Patients / रुग्ण']} />
        <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
