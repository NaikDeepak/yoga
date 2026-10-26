'use client';

import { useState } from 'react';
import { InlineForm } from '@/components/InlineForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { FeeTypeKey } from '@/lib/feeTypes';
import type { ActionResult } from '@/actions/patients';
import type { Translations } from '@/lib/i18n/en';
import { useTranslations } from '@/lib/i18n/context';

const FEE_TYPE_UI_LABEL: Record<FeeTypeKey, keyof Translations['charges']> = {
  consultation: 'feeTypeConsultation',
  monthly_yoga: 'feeTypeMonthlyYoga',
  package: 'feeTypePackage',
  session: 'feeTypeSession',
  assessment: 'feeTypeAssessment',
  other: 'feeTypeOther',
};

export type ChargeFeeType = { key: FeeTypeKey; defaultAmount: number | null };

export function AddChargeForm({
  action, today, feeTypes,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  today: string;
  /** The clinic's fee types (profile `practice.feeTypes`); the first one is the default. */
  feeTypes: readonly ChargeFeeType[];
}) {
  const t = useTranslations();
  const first = feeTypes[0];
  const amountFor = (key: FeeTypeKey) => {
    const preset = feeTypes.find((f) => f.key === key);
    return preset && preset.defaultAmount !== null ? String(preset.defaultAmount) : '';
  };
  const [feeType, setFeeType] = useState<FeeTypeKey>(first.key);
  const [amount, setAmount] = useState(() => amountFor(first.key));

  function handleTypeChange(next: FeeTypeKey) {
    setFeeType(next);
    setAmount(amountFor(next));
  }

  return (
    <InlineForm action={action} onReset={() => handleTypeChange(first.key)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="feeType">{t.charges.feeType}</Label>
          <NativeSelect
            id="feeType"
            name="feeType"
            value={feeType}
            onChange={(e) => handleTypeChange(e.target.value as FeeTypeKey)}
          >
            {feeTypes.map((f) => (
              <option key={f.key} value={f.key}>{t.charges[FEE_TYPE_UI_LABEL[f.key]]}</option>
            ))}
          </NativeSelect>
        </div>
        {feeType === 'other' && (
          <div className="space-y-1">
            <Label htmlFor="customLabel">{t.charges.customLabel}</Label>
            <Input id="customLabel" name="customLabel" placeholder={t.charges.customLabelPlaceholder} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="chargeAmount">{t.charges.amount}</Label>
          <Input
            id="chargeAmount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="chargeDate">{t.charges.chargeDate}</Label>
          <Input id="chargeDate" name="chargeDate" type="date" defaultValue={today} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="note">{t.charges.note}</Label>
          <Input id="note" name="note" placeholder={t.charges.notePlaceholder} />
        </div>
      </div>
      <SubmitButton size="sm" className="mt-3" pendingLabel={`${t.charges.addBtn}...`}>
        {t.charges.addBtn}
      </SubmitButton>
    </InlineForm>
  );
}
