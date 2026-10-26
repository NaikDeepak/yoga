import { describe, it, expect } from 'vitest';
import {
  TREATMENT_SECTIONS, TREATMENT_SECTION_KEYS, sectionsToShow, isModality,
} from '@/lib/treatment-sections';
import { pawar } from '@/clinics/pawar';
import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';

describe('TREATMENT_SECTIONS', () => {
  it('has one entry per key, each with a label in English and Marathi and an AI hint', () => {
    expect(TREATMENT_SECTIONS.map((s) => s.key)).toEqual([...TREATMENT_SECTION_KEYS]);
    for (const s of TREATMENT_SECTIONS) {
      expect(en.treatmentPlan[s.labelKey]).toBeTruthy();
      expect(mr.treatmentPlan[s.labelKey]).toBeTruthy();
      expect(s.aiHint.length).toBeGreaterThan(10);
    }
  });

  it('marks modality sections for the printout chips', () => {
    expect(isModality('panchkarma')).toBe(true);
    expect(isModality('exerciseTherapy')).toBe(true);
    expect(isModality('dietPlan')).toBe(false);
    expect(isModality('advice')).toBe(false);
  });
});

describe('sectionsToShow', () => {
  it("keeps the clinic's order when nothing else holds text", () => {
    expect(sectionsToShow(['exerciseTherapy', 'advice'], undefined)).toEqual(['exerciseTherapy', 'advice']);
    expect(sectionsToShow(['exerciseTherapy', 'advice'], { panchkarma: '  ', massage: null })).toEqual(['exerciseTherapy', 'advice']);
  });

  it('appends any other section that holds text (stored data is never hidden)', () => {
    expect(sectionsToShow(['exerciseTherapy', 'advice'], { panchkarma: 'x' })).toEqual(['exerciseTherapy', 'advice', 'panchkarma']);
  });

  it('does not repeat a section the clinic already lists', () => {
    expect(sectionsToShow(['advice'], { advice: 'x', massage: 'y' })).toEqual(['advice', 'massage']);
  });
});

describe("Pawar's practice", () => {
  it('uses the former PLAN_FIELDS order', () => {
    expect(pawar.practice.treatmentSections).toEqual(
      ['yogaProgram', 'pranayam', 'massage', 'yogaTherapy', 'dietPlan', 'medicines', 'panchkarma'],
    );
  });
});
