import { describe, it, expect } from 'vitest';
import { bilingual } from '@/lib/i18n/bilingual';
import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';

describe('bilingual', () => {
  it('returns "${en} / ${mr}" for a dotted key path', () => {
    const result = bilingual('common.save');
    expect(result).toBe(`${en.common.save} / ${mr.common.save}`);
  });

  it('interpolates parameters when provided', () => {
    const result = bilingual('calendar.patientsDue', { count: 5 });
    expect(result).toBe(`${en.calendar.patientsDue.replace('{count}', '5')} / ${mr.calendar.patientsDue.replace('{count}', '5')}`);
  });
});
