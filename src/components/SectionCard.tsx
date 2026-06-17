import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SectionCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerActions?: React.ReactNode;
}

export function SectionCard({ title, children, className, headerActions }: SectionCardProps) {
  return (
    <Card className={cn('rounded-2xl shadow-sm border-border', className)}>
      {title && (
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {headerActions}
        </CardHeader>
      )}
      <CardContent className={cn(!title && 'pt-6')}>{children}</CardContent>
    </Card>
  );
}
