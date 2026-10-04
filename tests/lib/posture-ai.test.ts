import { describe, it, expect } from 'vitest';
import {
  buildPostureAiPrompt, parseAiReport, MOCK_POSTURE_AI_REPORT, POSTURE_AI_RESPONSE_SCHEMA, type PostureAiContext,
} from '@/lib/posture-ai';
import { combineViews, detectPatterns, scorePosture } from '@/lib/posture-insights';
import { severity, type Metric, type MetricKey, type PostureView } from '@/lib/posture';

const mk = (key: MetricKey, value: number | null, over: Partial<Metric> = {}): Metric => ({
  key, value, unit: 'deg', side: null, direction: null, severity: severity(key, value), approx: false, ...over,
});

function context(over: Partial<PostureAiContext> = {}): PostureAiContext {
  const views: { view: PostureView; metrics: Metric[] }[] = [
    { view: 'front', metrics: [mk('shoulderLevel', 1, { side: 'right' }), mk('pelvicLevel', 0.1, { side: 'right' })] },
    { view: 'back', metrics: [mk('shoulderLevel', 3.3, { side: 'right' }), mk('pelvicLevel', 4.1, { side: 'right' })] },
    { view: 'left', metrics: [mk('forwardHead', 11, { direction: 'forward', approx: true })] },
    { view: 'right', metrics: [mk('forwardHead', 13.6, { direction: 'forward', approx: true })] },
  ];
  const measures = combineViews(views);
  return {
    client: { age: 46, gender: 'female', heightCm: 158, weightKg: 68, bmi: 27.2 },
    ailments: ['कंबर दुखी', 'Neck pain'],
    lifestyle: {
      chiefComplaint: 'Neck stiffness after work', duration: '6 months', workType: 'desk', dailySitting: '8+h',
      screenTime: '10h', activityLevel: 'sedentary', primaryGoal: 'Work without neck pain',
      doctorRestrictions: 'No inversions', contraindications: null,
    },
    assessment: {
      assessedOn: '2026-10-04',
      score: scorePosture(measures),
      patterns: detectPatterns(measures),
      measures,
      cameraLevel: 'reference',
    },
    library: [{ name: 'Neck Stretch', category: 'neck' }, { name: 'Bird Dog', category: 'core' }],
    ...over,
  };
}

describe('buildPostureAiPrompt', () => {
  const prompt = buildPostureAiPrompt(context());

  it('describes the client without identifying them', () => {
    expect(prompt).toContain('46y, female, 158 cm, 68 kg, BMI 27.2');
    expect(prompt).toContain('Ailments: कंबर दुखी, Neck pain');
    expect(prompt).toContain('Chief complaint: Neck stiffness after work (6 months)');
    expect(prompt).toContain('Doctor restrictions (must respect): No inversions');
  });

  it('includes the score, patterns and averaged measurements with confidence flags', () => {
    expect(prompt).toMatch(/Posture score: \d+\/100/);
    expect(prompt).toContain('Uneven pelvis (mild)');
    expect(prompt).toContain('Pelvic level: 2.1° right lower — mild — LOW CONFIDENCE (front 0.1°, back 4.1°)');
    expect(prompt).toContain('Forward head angle: 12.3° forward — mild — approximate');
  });

  it('lists the exercise library and the camera-level method', () => {
    expect(prompt).toContain('- Neck Stretch (neck)');
    expect(prompt).toContain('door-frame calibration (roll only)');
  });

  it('words every kind of measure', () => {
    const measures = combineViews([
      { view: 'front', metrics: [
        mk('trunkShift', 3, { side: 'left' }),
        mk('armHang', 2, { unit: 'cm', side: 'right' }),
        mk('kneeAlignment', 6, { side: 'left', direction: 'valgus' }),
        { ...mk('kneeAlignment', null), side: 'right' },
        mk('headTilt', 0),
      ] },
      { view: 'left', metrics: [mk('headForward', 1.5, { unit: 'pct', direction: 'forward' })] },
    ]);
    const p = buildPostureAiPrompt(context({
      client: { age: null, gender: null, heightCm: null, weightKg: null, bmi: null },
      assessment: { ...context().assessment, measures, patterns: [], cameraLevel: 'sensor', score: { overall: null, grade: null, regions: context().assessment.score.regions } },
    }));
    expect(p).toContain('Client: no details recorded');
    expect(p).toContain('Trunk shift: 3° shifted to left — mild');
    expect(p).toContain('Arm hang: 2 cm right arm further from the body — informational');
    expect(p).toContain('Knee alignment: 6° left leg valgus — mild');
    expect(p).toContain('Knee alignment (right leg): not measurable — informational');
    expect(p).toContain('Head tilt: 0° — normal');
    expect(p).toContain('Head vs plumb line: 1.5% of height forward — informational');
    expect(p).toContain('Camera level: phone tilt sensor');
    expect(p).toContain('Detected patterns:\n- none');
    expect(p).not.toContain('Posture score:');
  });

  it('copes with no lifestyle assessment, ailments or library', () => {
    const p = buildPostureAiPrompt(context({ lifestyle: null, ailments: [], library: [] }));
    expect(p).toContain('Ailments: none recorded');
    expect(p).toContain('Lifestyle assessment: not recorded');
    expect(p).toContain('Exercise library: none — give general advice only');
  });
});

describe('parseAiReport', () => {
  const valid = {
    summary: 'Mild forward head posture with an uneven pelvis.',
    keyFindings: [{ title: 'Forward head', explanation: 'Head about 12° ahead of the shoulders.' }],
    lifestyleLinks: ['8+ hours of desk work'],
    likelyCauses: ['Weak deep neck flexors'],
    risks: ['Chronic neck pain'],
    recommendations: { exercises: ['neck stretch', 'Plank'], ergonomics: ['Raise the monitor'], yogaAndBreathing: ['Bhujangasana'] },
    followUp: 'Reassess in 6 weeks.',
  };

  it('accepts a valid report and keeps only library exercises (canonical names)', () => {
    const r = parseAiReport(valid, ['Neck Stretch', 'Bird Dog']);
    expect(r.recommendations.exercises).toEqual(['Neck Stretch']);
    expect(r.summary).toBe(valid.summary);
  });

  it('rejects malformed output', () => {
    expect(() => parseAiReport({ ...valid, summary: '' }, [])).toThrow();
    expect(() => parseAiReport({ ...valid, keyFindings: 'nope' }, [])).toThrow();
    expect(() => parseAiReport('not json', [])).toThrow();
  });

  it('the mock report and response schema are well-formed', () => {
    expect(parseAiReport(MOCK_POSTURE_AI_REPORT, ['Neck Stretch'])).toBeTruthy();
    expect(POSTURE_AI_RESPONSE_SCHEMA.required).toContain('summary');
  });
});
