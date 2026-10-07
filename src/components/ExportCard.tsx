'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { buttonVariants } from '@/components/ui/button';
import { BRANCHES } from '@/lib/presets';
import { useTranslations } from '@/lib/i18n/context';
import { Download } from 'lucide-react';

/** Settings: download clients / visits / fees as CSV, for all branches or one (spec 2026-10-07-csv-export). */
export function ExportCard() {
  const t = useTranslations();
  const [branch, setBranch] = useState<string>('');

  const buildUrl = (kind: string) => {
    return branch ? `/api/export/${kind}?branch=${encodeURIComponent(branch)}` : `/api/export/${kind}`;
  };

  return (
    <Card className="rounded-2xl shadow-sm border-border max-w-lg">
      <CardHeader>
        <CardTitle className="text-base font-semibold">{t.export.title}</CardTitle>
        <CardDescription>{t.export.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="export-branch">{t.export.branchLabel}</Label>
          <select
            id="export-branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{t.export.allBranches}</option>
            {BRANCHES.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <a
            href={buildUrl('clients')}
            download
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' flex-1 justify-center gap-1.5'}
          >
            <Download className="size-4" />
            <span>{t.export.clients}</span>
          </a>
          <a
            href={buildUrl('visits')}
            download
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' flex-1 justify-center gap-1.5'}
          >
            <Download className="size-4" />
            <span>{t.export.visits}</span>
          </a>
          <a
            href={buildUrl('fees')}
            download
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' flex-1 justify-center gap-1.5'}
          >
            <Download className="size-4" />
            <span>{t.export.fees}</span>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
