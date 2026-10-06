// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlexibilitySection } from '@/components/posture/FlexibilitySection';
import { en } from '@/lib/i18n/en';
import { FLEX_SHOTS, measureShot, scoreFlexibility, type FlexMeasures } from '@/lib/flexibility';
import type { Flexibility } from '@/data/flexibility';
import { flexShot, fold } from '../helpers/flexibility';

function flexibility(overrides: Partial<Record<(typeof FLEX_SHOTS)[number], Parameters<typeof flexShot>[1]>> = {}, filePath: string | null = 'p.jpg'): Flexibility {
  const shots = FLEX_SHOTS.map((shot) => {
    const s = flexShot(shot, overrides[shot]);
    return {
      id: shot, assessmentId: 'a1', shot, filePath, imageWidth: s.imageWidth, imageHeight: s.imageHeight,
      landmarks: s.landmarks, landmarksEdited: false, cameraCheck: s.cameraCheck, createdAt: new Date(),
      measure: measureShot(shot, s.landmarks, { width: s.imageWidth, height: s.imageHeight }),
    };
  });
  const measures: FlexMeasures = Object.fromEntries(shots.map((s) => [s.shot, s.measure]));
  return { shots, scores: scoreFlexibility(measures) };
}

describe('FlexibilitySection', () => {
  it('offers to add tests when there are none', () => {
    render(<FlexibilitySection flexibility={{ shots: [], scores: { shoulderExtension: null, forwardFold: null, butterfly: null } }}
      photoUrls={{}} captureHref="/x" t={en} />);
    expect(screen.getByText(en.posture.flex.empty)).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(en.posture.flex.add) }).getAttribute('href')).toBe('/x');
  });

  it('shows a score, band and details per test, and offers a retake', () => {
    render(<FlexibilitySection flexibility={flexibility()} photoUrls={{}} captureHref="/x" t={en} />);
    for (const name of Object.values(en.posture.flex.tests)) expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText('75')).toBeTruthy(); // shoulder: both sides ~45°
    expect(screen.getAllByText(en.posture.flex.bands.flexible).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: new RegExp(en.posture.flex.retake) })).toBeTruthy();
  });

  it('shows the ideal pose beside each test', () => {
    render(<FlexibilitySection flexibility={flexibility()} photoUrls={{}} captureHref={null} t={en} />);
    expect(screen.getAllByRole('img', { name: en.posture.ideal })).toHaveLength(3);
  });

  it('shows quality flags', () => {
    const lms = fold(60, [700, 1700], [620, 1420]);
    const f = flexibility();
    const i = f.shots.findIndex((s) => s.shot === 'forwardFold');
    f.shots[i] = { ...f.shots[i], landmarks: lms, measure: measureShot('forwardFold', lms, { width: 1000, height: 2000 }) };
    f.scores = scoreFlexibility(Object.fromEntries(f.shots.map((s) => [s.shot, s.measure])));
    render(<FlexibilitySection flexibility={f} photoUrls={{}} captureHref={null} t={en} />);
    expect(screen.getByText(en.posture.flex.flags.kneesBent)).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull(); // no capture link when posture is switched off
  });

  it('says photos were deleted after consent was withdrawn', () => {
    render(<FlexibilitySection flexibility={flexibility({}, null)} photoUrls={{}} captureHref={null} t={en} />);
    expect(screen.getAllByText(en.posture.photoDeleted).length).toBe(4);
  });
});
