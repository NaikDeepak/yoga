'use client';

import { useState, useActionState } from 'react';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { BRANCHES } from '@/lib/presets';
import type { Patient } from '@/db/schema';
import type { ActionResult } from '@/actions/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useTranslations } from '@/lib/i18n/context';

function bmiVariant(bmi: number): string {
  if (bmi < 18.5) return 'bg-blue-100 text-blue-800';
  if (bmi < 25) return 'bg-primary/10 text-primary';
  if (bmi < 30) return 'bg-yellow-100 text-yellow-800';
  return 'bg-destructive/10 text-destructive';
}

export function PatientForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  defaultValues?: Patient;
  submitLabel: string;
}) {
  const t = useTranslations();
  const [weight, setWeight] = useState(defaultValues?.weightKg?.toString() ?? '');
  const [height, setHeight] = useState(defaultValues?.heightCm?.toString() ?? '');

  const [state, formAction, isPending] = useActionState(
    async (prevState: ActionResult | null, formData: FormData) => {
      if (formData.get('gender') === '__none__') formData.set('gender', '');
      if (formData.get('branch') === '__none__') formData.set('branch', '');
      return await action(formData);
    },
    null
  );

  const bmi = computeBmi(parseFloat(weight), parseFloat(height));

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state && !state.ok && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      {/* Personal Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.form.personalInfo}
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">{t.form.fullName} *</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            defaultValue={defaultValues?.fullName}
            placeholder={t.form.fullNamePlaceholder}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="photo">{t.form.photoLabel}</Label>
          <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="age">{t.form.age}</Label>
            <Input
              id="age"
              name="age"
              type="number"
              min="1"
              max="120"
              defaultValue={defaultValues?.age ?? ''}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">{t.form.gender}</Label>
            <Select name="gender" defaultValue={defaultValues?.gender ?? '__none__'}>
              <SelectTrigger id="gender">
                <SelectValue placeholder={t.form.selectGender} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— {t.form.selectGender} —</SelectItem>
                <SelectItem value="male">{t.form.genderMale}</SelectItem>
                <SelectItem value="female">{t.form.genderFemale}</SelectItem>
                <SelectItem value="other">{t.form.genderOther}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Body Metrics */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.form.bodyMetrics}
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weightKg">{t.form.weightKg}</Label>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              step="0.1"
              min="0.1"
              max="300"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heightCm">{t.form.heightCm}</Label>
            <Input
              id="heightCm"
              name="heightCm"
              type="number"
              step="0.1"
              min="0.1"
              max="250"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="—"
            />
          </div>
        </div>
        <div
          data-testid="bmi"
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            bmi !== null ? bmiVariant(bmi) : 'bg-muted text-muted-foreground'
          }`}
        >
          <span className="font-medium">BMI:</span>
          <span>{bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : '—'}</span>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t.form.contactInfo}
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mobile">{t.form.mobile} *</Label>
            <Input
              id="mobile"
              name="mobile"
              required
              defaultValue={defaultValues?.mobile}
              placeholder={t.form.mobilePlaceholder}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t.form.email}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues?.email ?? ''}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">{t.form.occupation}</Label>
            <Input
              id="occupation"
              name="occupation"
              defaultValue={defaultValues?.occupation ?? ''}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContact">{t.form.emergencyContact}</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              defaultValue={defaultValues?.emergencyContact ?? ''}
              placeholder="—"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">{t.form.address}</Label>
          <Textarea
            id="address"
            name="address"
            defaultValue={defaultValues?.address ?? ''}
            rows={2}
            placeholder="—"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="branch">{t.form.branch}</Label>
          <Select name="branch" defaultValue={defaultValues?.branch || '__none__'}>
            <SelectTrigger id="branch">
              <SelectValue placeholder={t.form.selectBranch} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— {t.form.selectBranch} —</SelectItem>
              {BRANCHES.map((b) => (
                <SelectItem key={b.key} value={b.key}>{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? t.common.saving : submitLabel}
      </Button>
    </form>
  );
}
