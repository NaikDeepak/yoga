'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Pencil, Printer, Receipt } from 'lucide-react';
import type { Patient } from '@/db/schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function PatientHeader({
  patient,
  photoUrl,
  hasCourseFee,
}: {
  patient: Patient;
  photoUrl: string | null;
  hasCourseFee: boolean;
}) {
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      setIsCompact(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {photoUrl && <AvatarImage src={photoUrl} alt={patient.fullName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials(patient.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{patient.fullName}</h1>
            <Badge variant="outline" className="border-brand-accent text-brand-accent">
              {patient.patientCode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{patient.mobile}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.id}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit / बदला
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${patient.id}/print`}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Report / अहवाल
            </Link>
          </Button>
          {hasCourseFee && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/patients/${patient.id}/receipt`}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Receipt / पावती
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Sentinel: once this scrolls above the viewport, the full header is gone and we show the compact bar */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <div
        data-testid="compact-header"
        aria-hidden={!isCompact}
        className={cn(
          'sticky top-14 z-10 overflow-hidden bg-card transition-all duration-200',
          isCompact ? 'max-h-16 border-b border-border opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <Avatar className="h-8 w-8">
            {photoUrl && <AvatarImage src={photoUrl} alt={patient.fullName} />}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials(patient.fullName)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium">{patient.fullName}</span>
          <Badge variant="outline" className="border-brand-accent text-brand-accent">
            {patient.patientCode}
          </Badge>
        </div>
      </div>
    </>
  );
}
