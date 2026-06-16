'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

export function RevenueStatCard({ value }: { value: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5000); // Hides after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return (
    <Card className="rounded-2xl shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Revenue This Month
        </CardTitle>
        <button
          onClick={() => setVisible(!visible)}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-accent transition-colors"
          title={visible ? 'Hide revenue' : 'Show revenue'}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">
          {visible ? `₹${value.toLocaleString('en-IN')}` : '₹••••'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          Tracking well
        </p>
      </CardContent>
    </Card>
  );
}
