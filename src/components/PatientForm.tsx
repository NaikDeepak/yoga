'use client';

import { useState, useTransition } from 'react';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import type { Patient } from '@/db/schema';
import type { ActionResult } from '@/actions/patients';

const field = 'mt-1 w-full rounded border border-stone-300 p-2';
const label = 'block text-sm font-medium';

export function PatientForm({
  action, defaultValues, submitLabel,
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
      const result = await action(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <form action={onSubmit} className="max-w-2xl space-y-4">
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <label className={label}>Full Name / पूर्ण नाव *
        <input name="fullName" required defaultValue={defaultValues?.fullName} className={field} />
      </label>
      <label className={label}>Photo / फोटो
        <input name="photo" type="file" accept="image/jpeg,image/png" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className={label}>Age / वय
          <input name="age" type="number" defaultValue={defaultValues?.age ?? ''} className={field} />
        </label>
        <label className={label}>Gender / लिंग
          <select name="gender" defaultValue={defaultValues?.gender ?? ''} className={field}>
            <option value="">—</option>
            <option value="male">Male / पुरुष</option>
            <option value="female">Female / स्त्री</option>
            <option value="other">Other / इतर</option>
          </select>
        </label>
        <label className={label}>Weight (kg) / वजन
          <input name="weightKg" type="number" step="0.1" value={weight}
            onChange={(e) => setWeight(e.target.value)} className={field} />
        </label>
        <label className={label}>Height (cm) / उंची
          <input name="heightCm" type="number" step="0.1" value={height}
            onChange={(e) => setHeight(e.target.value)} className={field} />
        </label>
      </div>
      <p data-testid="bmi" className="rounded bg-emerald-50 p-2 text-sm">
        BMI: {bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : '—'}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className={label}>Mobile / मोबाईल *
          <input name="mobile" required defaultValue={defaultValues?.mobile} className={field} />
        </label>
        <label className={label}>Email / ईमेल
          <input name="email" type="email" defaultValue={defaultValues?.email ?? ''} className={field} />
        </label>
        <label className={label}>Occupation / व्यवसाय
          <input name="occupation" defaultValue={defaultValues?.occupation ?? ''} className={field} />
        </label>
        <label className={label}>Emergency Contact / आपत्कालीन संपर्क
          <input name="emergencyContact" defaultValue={defaultValues?.emergencyContact ?? ''} className={field} />
        </label>
      </div>
      <label className={label}>Address / पत्ता
        <textarea name="address" defaultValue={defaultValues?.address ?? ''} className={field} rows={2} />
      </label>
      <button disabled={pending}
        className="rounded bg-emerald-700 px-6 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-50">
        {pending ? 'Saving… / जतन होत आहे…' : submitLabel}
      </button>
    </form>
  );
}
