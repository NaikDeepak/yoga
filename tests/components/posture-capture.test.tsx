// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React, { useRef } from 'react';
import { PostureCapture } from '@/components/posture/PostureCapture';
import { en } from '@/lib/i18n/en';
import { LocaleProvider } from '@/lib/i18n/context';
import { alignedLandmarks, POSTURE_W, POSTURE_H } from '../helpers/posture';
import { butterfly, fold, shoulderShot } from '../helpers/flexibility';
import { POSTURE_VIEWS, type Landmark } from '@/lib/posture';
import { savePostureAssessmentAction, replacePostureViewsAction, saveFlexibilityTestsAction } from '@/actions/posture';

// ── Mock state ───────────────────────────────────────────────────────────────
let liveLandmarks: Landmark[] | null = null;
let stillLandmarks: Landmark[] | null = null;
let stillModelReject = false;
let autoLandmarks = false;
let deviceLevelState: { supported: boolean | null; level: { rollDeg: number; pitchDeg: number | null } | null } = {
  supported: true,
  level: { rollDeg: 0, pitchDeg: 0 },
};

function getActiveViewLandmarks(): Landmark[] {
  const text = document.body.textContent || '';
  if (text.includes(en.posture.flex.shots.shoulderExtLeft)) {
    return shoulderShot(45).map((l) => ({ ...l, x: l.visibility ? 1 - l.x : l.x }));
  }
  if (text.includes(en.posture.flex.shots.shoulderExtRight)) {
    return shoulderShot(45);
  }
  if (text.includes(en.posture.flex.shots.forwardFold)) {
    return fold(60, [700, 1700]);
  }
  if (text.includes(en.posture.flex.shots.butterfly)) {
    return butterfly(100, 100);
  }
  if (text.includes(en.posture.views.back)) {
    return alignedLandmarks('back', {
      LEFT_SHOULDER: [400, 500], RIGHT_SHOULDER: [600, 500], LEFT_HIP: [440, 1000], RIGHT_HIP: [560, 1000],
    });
  }
  if (text.includes(en.posture.views.right)) {
    return alignedLandmarks('left'); // faces image-right
  }
  if (text.includes(en.posture.views.left)) {
    return alignedLandmarks('left').map((l) => ({ ...l, x: l.visibility ? 1 - l.x : l.x }));
  }
  if (text.includes(en.posture.views.front)) {
    return alignedLandmarks('front');
  }
  return alignedLandmarks('front');
}

function getLiveLandmarks(): Landmark[] | null {
  if (liveLandmarks !== null) return liveLandmarks;
  if (autoLandmarks) return getActiveViewLandmarks();
  return null;
}

function getStillLandmarks(): Landmark[] | null {
  if (stillLandmarks !== null) return stillLandmarks;
  if (autoLandmarks) return getActiveViewLandmarks();
  return null;
}

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('@/components/posture/pose-detector', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/posture/pose-detector')>();
  return {
    ...actual,
    createPoseDetector: vi.fn(async (kind: 'live' | 'still') => {
      if (kind === 'live') {
        return {
          detectForVideo: vi.fn((_video: unknown, _ts: number) => {
            const lms = getLiveLandmarks();
            return { landmarks: lms ? [lms] : [] };
          }),
          detect: vi.fn(() => ({ landmarks: [] })),
          close: vi.fn(),
        };
      }
      if (stillModelReject) {
        throw new Error('Pose model download failed');
      }
      return {
        detect: vi.fn((_image: unknown) => {
          const lms = getStillLandmarks();
          return { landmarks: lms ? [lms] : [] };
        }),
        detectForVideo: vi.fn(() => ({ landmarks: [] })),
        close: vi.fn(),
      };
    }),
  };
});

vi.mock('@/components/posture/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/posture/hooks')>();
  return {
    ...actual,
    useCamera: vi.fn((_facingMode: string, cameraOn: boolean) => {
      const videoRef = useRef<HTMLVideoElement>(null);
      return {
        videoRef,
        size: cameraOn ? { width: POSTURE_W, height: POSTURE_H } : null,
        error: null,
      };
    }),
    useDeviceLevel: vi.fn(() => deviceLevelState),
    requestMotionPermission: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('@/components/posture/voice', () => ({
  createVoiceGuide: vi.fn(() => ({
    unlock: vi.fn(),
    say: vi.fn(),
    beep: vi.fn(),
    setMuted: vi.fn(),
    stop: vi.fn(),
  })),
  loadMuted: vi.fn(() => true),
  saveMuted: vi.fn(),
}));

vi.mock('@/actions/posture', () => ({
  savePostureAssessmentAction: vi.fn().mockResolvedValue({ ok: true }),
  replacePostureViewsAction: vi.fn().mockResolvedValue({ ok: true }),
  saveFlexibilityTestsAction: vi.fn().mockResolvedValue({ ok: true }),
}));

// ── jsdom environment stubs ──────────────────────────────────────────────────
beforeAll(() => {
  Element.prototype.setPointerCapture = vi.fn();
  (SVGSVGElement.prototype as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
  (globalThis as unknown as { DOMPoint: unknown }).DOMPoint = class {
    constructor(public x: number, public y: number) {}
    matrixTransform() { return this; }
  };
  if (!('PointerEvent' in globalThis)) {
    (globalThis as unknown as { PointerEvent: unknown }).PointerEvent = class extends MouseEvent {};
  }

  Object.defineProperty(HTMLVideoElement.prototype, 'readyState', {
    get: () => 4,
    configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    get: () => POSTURE_W,
    configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    get: () => POSTURE_H,
    configurable: true,
  });
  HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn(),
    putImageData: vi.fn(),
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.toBlob = vi.fn(function (
    this: HTMLCanvasElement,
    callback: (blob: Blob | null) => void,
    type?: string,
  ) {
    callback(new Blob(['fake-jpg-data'], { type: type || 'image/jpeg' }));
  });

  globalThis.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-capture-photo');
  globalThis.URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  liveLandmarks = null;
  stillLandmarks = null;
  stillModelReject = false;
  autoLandmarks = false;
  deviceLevelState = {
    supported: true,
    level: { rollDeg: 0, pitchDeg: 0 },
  };
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPosture(props: React.ComponentProps<typeof PostureCapture>) {
  return render(
    <LocaleProvider locale="en">
      <PostureCapture {...props} />
    </LocaleProvider>,
  );
}

async function startCameraAndReady() {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.start) }));
  // 1st tick: createPoseDetector resolves, modelReady becomes true
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
  // 2nd tick: live RAF loop executes, computes frame checks
  await act(async () => { await vi.advanceTimersByTimeAsync(50); });
}

// ── Tests ───────────────────────────────────────────────────────────────────
describe('PostureCapture Component', () => {
  describe('Case 1: Consent', () => {
    it('disables Start camera until consent is ticked for new assessment, enables immediately for retake', () => {
      const { unmount } = renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      const startBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.start) });
      const consentBox = screen.getByRole('checkbox');

      expect(consentBox).not.toBeChecked();
      expect(startBtn).toBeDisabled();

      fireEvent.click(consentBox);
      expect(consentBox).toBeChecked();
      expect(startBtn).toBeEnabled();

      fireEvent.click(consentBox);
      expect(startBtn).toBeDisabled();

      unmount();

      // Retake mode: no consent checkbox, Start button enabled immediately
      renderPosture({
        patientId: 'p1',
        patientName: 'Asha Pawar',
        retake: { assessmentId: 'a1', views: ['front'] },
      });

      expect(screen.queryByRole('checkbox')).toBeNull();
      const retakeStartBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.start) });
      expect(retakeStartBtn).toBeEnabled();
    });
  });

  describe('Case 2: Live checks', () => {
    it('disables Capture and turns off in-frame chip when nobody in frame, turns on with pose', async () => {
      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      // Nobody in frame
      liveLandmarks = null;
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });

      const captureBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) });
      expect(captureBtn).toBeDisabled();

      const inFrameChip = screen.getByText(en.posture.capture.checks.inFrame).closest('span')!;
      expect(inFrameChip.className).toContain('bg-muted');

      // Pose in frame
      liveLandmarks = alignedLandmarks('front');
      await act(async () => { await vi.advanceTimersByTimeAsync(50); });

      expect(captureBtn).toBeEnabled();
      expect(inFrameChip.className).toContain('bg-primary/10');
    });
  });

  describe('Case 3: Auto-capture', () => {
    it('moves from live to review after countdown when pose is still and camera is level', async () => {
      liveLandmarks = alignedLandmarks('front');
      stillLandmarks = alignedLandmarks('front');

      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      // 15 frames for still (~240ms) + 3000ms countdown + 240ms still detections = ~3500ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });

      // Screen moves to review
      expect(screen.getByText(en.posture.capture.reviewHelp)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(en.posture.capture.usePhoto) })).toBeInTheDocument();
    });
  });

  describe('Case 4: Camera not level', () => {
    it('does not auto-capture and keeps Capture disabled when camera is tilted (rollDeg: 10)', async () => {
      liveLandmarks = alignedLandmarks('front');
      stillLandmarks = alignedLandmarks('front');
      deviceLevelState = { supported: true, level: { rollDeg: 10, pitchDeg: 0 } };

      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });

      // Still in live mode, no review help
      expect(screen.queryByText(en.posture.capture.reviewHelp)).toBeNull();
      const captureBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) });
      expect(captureBtn).toBeDisabled();

      const levelChip = screen.getByText(en.posture.capture.checks.level).closest('span')!;
      expect(levelChip.className).toContain('bg-muted');
    });
  });

  describe('Case 5: No person in the still photo', () => {
    it('shows noPerson error alert and stays on live when still detector finds nobody', async () => {
      liveLandmarks = alignedLandmarks('front');
      stillLandmarks = null; // still detector returns no landmarks

      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      const captureBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) });
      expect(captureBtn).toBeEnabled();

      fireEvent.click(captureBtn);

      // Advance through the 3 detections (gap 120ms each)
      await act(async () => { await vi.advanceTimersByTimeAsync(350); });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(en.posture.capture.noPerson);
      expect(screen.queryByText(en.posture.capture.reviewHelp)).toBeNull();
    });
  });

  describe('Case 6: Model failed', () => {
    it('shows modelError alert when still detector fails to load', async () => {
      liveLandmarks = alignedLandmarks('front');
      stillModelReject = true; // still detector rejects

      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      const captureBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) });
      expect(captureBtn).toBeEnabled();

      fireEvent.click(captureBtn);

      await act(async () => { await vi.advanceTimersByTimeAsync(50); });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(en.posture.capture.modelError);
      expect(screen.queryByText(en.posture.capture.reviewHelp)).toBeNull();
    });
  });

  describe('Case 7: Full run', () => {
    it('accepts all 4 views and saves assessment with consent, note, 4 views, and 4 photo files', async () => {
      autoLandmarks = true;

      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      // Complete all 4 views: front -> right -> back -> left
      for (const view of POSTURE_VIEWS) {
        // Wait for frame analysis for this view
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });

        const captureBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) });
        expect(captureBtn).toBeEnabled();
        fireEvent.click(captureBtn);

        // Advance through detection delays into review
        await act(async () => { await vi.advanceTimersByTimeAsync(350); });
        expect(screen.getByText(en.posture.capture.reviewHelp)).toBeInTheDocument();

        // Accept photo
        const usePhotoBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.usePhoto) });
        fireEvent.click(usePhotoBtn);
      }

      // Reached summary screen
      expect(screen.getByText(en.posture.capture.summaryTitle)).toBeInTheDocument();

      // Add a note
      const noteInput = screen.getByLabelText(en.posture.note);
      fireEvent.change(noteInput, { target: { value: 'Mild forward head posture' } });

      // Save assessment
      const saveBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.save) });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(savePostureAssessmentAction).toHaveBeenCalledTimes(1);
      const [patientId, formData] = vi.mocked(savePostureAssessmentAction).mock.calls[0];
      expect(patientId).toBe('p1');
      expect(formData).toBeInstanceOf(FormData);

      const payload = JSON.parse(formData.get('payload') as string);
      expect(payload.consent).toBe(true);
      expect(payload.note).toBe('Mild forward head posture');
      expect(payload.views).toHaveLength(4);
      expect(payload.views.map((v: { view: string }) => v.view)).toEqual(['front', 'right', 'back', 'left']);

      for (const view of POSTURE_VIEWS) {
        const photo = formData.get(`photo_${view}`);
        expect(photo).toBeInstanceOf(File);
        expect((photo as File).type).toBe('image/jpeg');
      }
    });
  });

  describe('Case 8: Flexibility mode', () => {
    it('captures flexibility shots and calls saveFlexibilityTestsAction on save', async () => {
      autoLandmarks = true;

      renderPosture({
        patientId: 'p1',
        patientName: 'Asha Pawar',
        flexibility: {
          assessmentId: 'a1',
          shots: ['shoulderExtRight', 'forwardFold'],
        },
      });

      // Setup screen shows flexibility capture title, no consent checkbox needed
      expect(screen.getByText(en.posture.flex.captureTitle)).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).toBeNull();

      await startCameraAndReady();

      // Complete shot 1: shoulderExtRight
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) }));
      await act(async () => { await vi.advanceTimersByTimeAsync(350); });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.usePhoto) }));

      // Complete shot 2: forwardFold
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) }));
      await act(async () => { await vi.advanceTimersByTimeAsync(350); });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.usePhoto) }));

      // Summary screen
      expect(screen.getByText(en.posture.capture.summaryTitle)).toBeInTheDocument();

      const saveBtn = screen.getByRole('button', { name: new RegExp(en.posture.capture.save) });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(saveFlexibilityTestsAction).toHaveBeenCalledTimes(1);
      const [patientId, assessmentId, formData] = vi.mocked(saveFlexibilityTestsAction).mock.calls[0];
      expect(patientId).toBe('p1');
      expect(assessmentId).toBe('a1');

      const payload = JSON.parse(formData.get('payload') as string);
      expect(payload.shots).toHaveLength(2);
      expect(payload.shots.map((s: { shot: string }) => s.shot)).toEqual(['shoulderExtRight', 'forwardFold']);

      expect(formData.get('photo_shoulderExtRight')).toBeInstanceOf(File);
      expect(formData.get('photo_forwardFold')).toBeInstanceOf(File);
    });
  });

  describe('Case 9: Retake from summary', () => {
    it('returns to live view when tapping a thumbnail on summary screen', async () => {
      autoLandmarks = true;

      renderPosture({ patientId: 'p1', patientName: 'Asha Pawar' });

      fireEvent.click(screen.getByRole('checkbox'));
      await startCameraAndReady();

      for (const view of POSTURE_VIEWS) {
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) }));
        await act(async () => { await vi.advanceTimersByTimeAsync(350); });
        fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.usePhoto) }));
      }

      // On summary screen
      expect(screen.getByText(en.posture.capture.summaryTitle)).toBeInTheDocument();

      // Tap thumbnail for view 1 ('right' side)
      const thumbnailButtons = screen.getAllByRole('button').filter((btn) => btn.querySelector('img'));
      expect(thumbnailButtons).toHaveLength(4);

      fireEvent.click(thumbnailButtons[1]);

      // Returns to live mode for Right side (step 2 of 4)
      expect(screen.queryByText(en.posture.capture.summaryTitle)).toBeNull();
      expect(screen.getByText(new RegExp(en.posture.views.right))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) })).toBeInTheDocument();
    });
  });

  describe('Capture counters (E4)', () => {
    const sent = () => vi.mocked(navigator.sendBeacon).mock.calls.map(([, blob]) => blob as Blob);
    const counts = async () => (await Promise.all(sent().map(async (b) => JSON.parse(await b.text()).counts))).flat();

    beforeEach(() => {
      Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true });
    });

    it('sends one batch on save: tries, capture and the save tap, by photo type — nothing about the client', async () => {
      autoLandmarks = true;
      renderPosture({ patientId: 'p1', patientName: 'Asha Kulkarni', retake: { assessmentId: 'a1', views: ['front'] } });
      await startCameraAndReady();
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) }));
      await act(async () => { await vi.advanceTimersByTimeAsync(350); });
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.usePhoto) }));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.save) })); });

      expect(sent()).toHaveLength(1);
      const c = await counts();
      expect(c).toEqual(expect.arrayContaining([
        { event: 'attemptManual', shot: 'front', n: 1 },
        { event: 'captured', shot: 'front', n: 1 },
        { event: 'saveTapped', shot: null, n: 1 },
      ]));
      const body = await sent()[0].text();
      expect(body).not.toContain('p1');
      expect(body).not.toContain('Asha');
    });

    it('counts a blocked capture and sends it when the screen closes', async () => {
      liveLandmarks = alignedLandmarks('front');
      stillLandmarks = null;
      const { unmount } = renderPosture({ patientId: 'p1', patientName: 'Asha Kulkarni', retake: { assessmentId: 'a1', views: ['front'] } });
      await startCameraAndReady();
      fireEvent.click(screen.getByRole('button', { name: new RegExp(en.posture.capture.capture) }));
      await act(async () => { await vi.advanceTimersByTimeAsync(350); });
      expect(sent()).toHaveLength(0);
      unmount();
      expect(await counts()).toEqual(expect.arrayContaining([{ event: 'blockedNoPerson', shot: 'front', n: 1 }]));
    });
  });
});

