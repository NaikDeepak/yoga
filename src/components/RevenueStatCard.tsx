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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          Revenue / महसूल
        </CardTitle>
        <button
          onClick={() => setVisible(!visible)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={visible ? 'Hide revenue' : 'Show revenue'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {visible ? `₹${value.toLocaleString('en-IN')}` : '₹••••'}
        </p>
      </CardContent>
    </Card>
  );
}
