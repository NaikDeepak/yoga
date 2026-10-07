// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostureScoreCard } from '@/components/posture/PostureScoreCard';
import type { LatestPostureScore } from '@/data/posture';
import { en } from '@/lib/i18n/en';

const latest = (over: Partial<LatestPostureScore> = {}): LatestPostureScore => ({
  assessmentId: 'a2', assessedOn: '2026-10-04', score: 80, grade: 'fair', mildCount: 1, markedCount: 0,
  previousId: 'a1', previousOn: '2026-09-01', previousScore: 72, total: null, previousTotal: null, ...over,
});

describe('PostureScoreCard', () => {
  it('shows the trend since the previous assessment', () => {
    render(<PostureScoreCard patientId="p1" latest={latest()} t={en} />);
    expect(screen.getByText('+8')).toBeTruthy();
    expect(screen.getByText(/Improved since/)).toBeTruthy();
  });

  it('says so when the previous assessment had no measurable score', () => {
    render(<PostureScoreCard patientId="p1" latest={latest({ previousScore: null })} t={en} />);
    expect(screen.getByText(en.posture.overviewCard.previousNotMeasured)).toBeTruthy();
  });

  it('marks a first assessment and links no comparison', () => {
    render(<PostureScoreCard patientId="p1" latest={latest({ previousId: null, previousOn: null, previousScore: null })} t={en} />);
    expect(screen.getByText(en.posture.overviewCard.firstAssessment)).toBeTruthy();
    expect(screen.queryByText(en.posture.overviewCard.compare)).toBeNull();
  });

  it('invites a first capture when there is none', () => {
    render(<PostureScoreCard patientId="p1" latest={undefined} t={en} />);
    expect(screen.getByText(en.posture.overviewCard.none)).toBeTruthy();
  });

  it('shows the total /400 with its trend when the latest assessment has one', () => {
    render(<PostureScoreCard patientId="p1" latest={latest({ total: 300, previousTotal: 280 })} t={en} />);
    expect(screen.getByText('Total 300/400')).toBeTruthy();
    expect(screen.getAllByText(/Improved/).length).toBeGreaterThan(0);
  });

  it('no total line without a complete total', () => {
    render(<PostureScoreCard patientId="p1" latest={latest({ total: null })} t={en} />);
    expect(screen.queryByText(/Total/)).toBeNull();
  });
});
