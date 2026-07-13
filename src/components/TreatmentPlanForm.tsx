'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { InlineForm } from '@/components/InlineForm';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { TreatmentPlan } from '@/db/schema';
import type { TreatmentDraftFields } from '@/lib/gemini';
import { useTranslations } from '@/lib/i18n/context';

export function TreatmentPlanForm({
  patientId,
  initialPlan,
}: {
  patientId: string;
  initialPlan: TreatmentPlan | undefined;
}) {
  const t = useTranslations();

  const PLAN_FIELDS: [keyof TreatmentDraftFields, string][] = [
    ['yogaProgram', t.treatmentPlan.yoga],
    ['pranayam', t.treatmentPlan.pranayam],
    ['massage', t.treatmentPlan.massage],
    ['yogaTherapy', t.treatmentPlan.yogaTherapy],
    ['dietPlan', t.treatmentPlan.diet],
    ['medicines', t.treatmentPlan.medicines],
    ['panchkarma', t.treatmentPlan.panchkarma],
  ];

  const [fields, setFields] = useState<TreatmentDraftFields>({
    yogaProgram: initialPlan?.yogaProgram ?? '',
    pranayam: initialPlan?.pranayam ?? '',
    massage: initialPlan?.massage ?? '',
    yogaTherapy: initialPlan?.yogaTherapy ?? '',
    dietPlan: initialPlan?.dietPlan ?? '',
    medicines: initialPlan?.medicines ?? '',
    panchkarma: initialPlan?.panchkarma ?? '',
  });
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const hasContent = Object.values(fields).some((v) => v.trim().length > 0);

  async function doGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/ai/treatment-plan/${patientId}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const draft = await res.json() as TreatmentDraftFields;
      setFields(draft);
    } catch (err) {
      console.error('AI generation failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerate() {
    if (hasContent) {
      setShowConfirm(true);
    } else {
      void doGenerate();
    }
  }

  return (
    <>
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.treatmentPlan.replaceTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.treatmentPlan.replaceDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.treatmentPlan.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                void doGenerate();
              }}
            >
              {t.treatmentPlan.continueBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t.treatmentPlan.title}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t.treatmentPlan.generatingBtn}
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                {t.treatmentPlan.generateBtn}
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {genError && (
            <p className="mb-3 text-sm text-destructive font-medium">
              {t.treatmentPlan.aiError}: {genError} — {t.treatmentPlan.tryAgain}
            </p>
          )}
          <InlineForm
            action={saveTreatmentPlanAction.bind(null, patientId)}
            className="space-y-3"
          >
            {PLAN_FIELDS.map(([name, title]) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`plan-${name}`}>{title}</Label>
                <Textarea
                  id={`plan-${name}`}
                  name={name}
                  rows={2}
                  value={fields[name]}
                  onChange={(e) => setFields((prev) => ({ ...prev, [name]: e.target.value }))}
                  disabled={generating}
                />
              </div>
            ))}
            <SubmitButton size="sm" disabled={generating} pendingLabel={`${t.treatmentPlan.saveBtn}...`}>
              {t.treatmentPlan.saveBtn}
            </SubmitButton>
          </InlineForm>
        </CardContent>
      </Card>
    </>
  );
}
