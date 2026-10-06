'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/lib/i18n/context';
import { deletePatientAction } from '@/actions/patients';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Danger zone on the edit page: permanently erases the client and all their files. The physio types
 * the client's full name to enable the button (the server checks it again).
 */
export function DeleteClientCard({ patientId, fullName }: { patientId: string; fullName: string }) {
  const t = useTranslations().deleteClient;
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = norm(typed) === norm(fullName);

  const remove = () => start(async () => {
    setError(null);
    const r = await deletePatientAction(patientId, typed); // redirects to the client list on success
    if (r && !r.ok) setError(r.error);
  });

  return (
    <Card className="rounded-2xl border-destructive/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-destructive">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{t.warning}</p>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">{t.typeName.replace('{name}', fullName)}</span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        <Button variant="destructive" size="sm" disabled={!matches || pending} onClick={remove}>
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {pending ? t.deleting : t.button}
        </Button>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
