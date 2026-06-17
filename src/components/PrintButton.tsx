'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from '@/lib/i18n/context';

export function PrintButton() {
  const t = useTranslations();
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
      {t.print.downloadPdf}
    </Button>
  );
}
