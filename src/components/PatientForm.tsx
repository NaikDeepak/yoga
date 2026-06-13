'use client';

import { useState, useTransition } from 'react';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import type { Patient } from '@/db/schema';
import type { ActionResult } from '@/actions/patients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
  const [weight, setWeight] = useState(defaultValues?.weightKg?.toString() ?? '');
  const [height, setHeight] = useState(defaultValues?.heightCm?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bmi = computeBmi(parseFloat(weight), parseFloat(height));

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      if (formData.get('gender') === '__none__') formData.set('gender', '');
      const result = await action(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="max-w-2xl space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Personal Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Personal Info / वैयक्तिक माहिती
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name / पूर्ण नाव *</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            defaultValue={defaultValues?.fullName}
            placeholder="Patient full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="photo">Photo / फोटो</Label>
          <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="age">Age / वय</Label>
            <Input
              id="age"
              name="age"
              type="number"
              defaultValue={defaultValues?.age ?? ''}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender / लिंग</Label>
            <Select name="gender" defaultValue={defaultValues?.gender ?? '__none__'}>
              <SelectTrigger id="gender">
                <SelectValue placeholder="Select / निवडा" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Select / निवडा —</SelectItem>
                <SelectItem value="male">Male / पुरुष</SelectItem>
                <SelectItem value="female">Female / स्त्री</SelectItem>
                <SelectItem value="other">Other / इतर</SelectItem>
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
            Body Metrics / शरीर मोजमाप
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weightKg">Weight (kg) / वजन</Label>
            <Input
              id="weightKg"
              name="weightKg"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heightCm">Height (cm) / उंची</Label>
            <Input
              id="heightCm"
              name="heightCm"
              type="number"
              step="0.1"
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
            Contact / संपर्क
          </span>
          <Separator className="flex-1" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile / मोबाईल *</Label>
            <Input
              id="mobile"
              name="mobile"
              required
              defaultValue={defaultValues?.mobile}
              placeholder="10-digit mobile"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email / ईमेल</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues?.email ?? ''}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation / व्यवसाय</Label>
            <Input
              id="occupation"
              name="occupation"
              defaultValue={defaultValues?.occupation ?? ''}
              placeholder="—"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency Contact / आपत्कालीन संपर्क</Label>
            <Input
              id="emergencyContact"
              name="emergencyContact"
              defaultValue={defaultValues?.emergencyContact ?? ''}
              placeholder="—"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address / पत्ता</Label>
          <Textarea
            id="address"
            name="address"
            defaultValue={defaultValues?.address ?? ''}
            rows={2}
            placeholder="—"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? 'Saving… / जतन होत आहे…' : submitLabel}
      </Button>
    </form>
  );
}
