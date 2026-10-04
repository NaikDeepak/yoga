'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Camera, Check, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/lib/i18n/context';
import { savePostureAssessmentAction } from '@/actions/posture';
import { buildOverlay } from '@/lib/posture-overlay';
import { POSTURE_VIEWS, type Landmark, type PostureView } from '@/lib/posture';
import {
  checkFrame, isLevel, isStill, rollFromReferenceLine, type CameraCheck, type FrameChecks,
} from '@/lib/posture-capture';
import { createPoseDetector, toLandmarks } from './pose-detector';
import { requestMotionPermission, useCamera, useDeviceLevel } from './hooks';
import { OverlaySvg } from './PostureFigure';
import { DragHandles } from './DragHandles';
import { LandmarkEditor } from './LandmarkEditor';
import { LevelIndicator } from './LevelIndicator';

type Step = 'setup' | 'live' | 'review' | 'summary';

interface Capture {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  landmarks: Landmark[];
  edited: boolean;
  cameraCheck: CameraCheck;
}

const MAX_EDGE = 1280;       // px; keeps four JPEGs well under the 4 MB upload cap
const JPEG_QUALITY = 0.85;
const COUNTDOWN_SECONDS = 3;
const HISTORY_FRAMES = 30;

/** Sizes a media box to its aspect ratio while fitting within 70% of the viewport height. */
const stageStyle = (w: number, h: number) => ({
  aspectRatio: `${w} / ${h}`,
  width: `min(100%, calc(70vh * ${w} / ${h}))`,
});

export function PostureCapture({ patientId, patientName }: { patientId: string; patientName: string }) {
  const t = useTranslations();
  const p = t.posture;
  const c = p.capture;

  const [step, setStep] = useState<Step>('setup');
  const [consent, setConsent] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [viewIdx, setViewIdx] = useState(0);
  const view = POSTURE_VIEWS[viewIdx];
  const [captures, setCaptures] = useState<Partial<Record<PostureView, Capture>>>({});
  const [draft, setDraft] = useState<Capture | null>(null);
  const [referenceRoll, setReferenceRoll] = useState<number | null>(null);
  const [recalibrating, setRecalibrating] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, startSaving] = useTransition();

  const cameraOn = step === 'live';
  const { videoRef, size, error: cameraError } = useCamera(facingMode, cameraOn);
  const sensor = useDeviceLevel(step !== 'setup');
  const sensorMode = sensor.supported === true;
  const needsCalibration = cameraOn && sensor.supported === false && (referenceRoll === null || recalibrating);

  // ── pose models ──
  const liveDetector = useRef<PoseLandmarker | null>(null);
  const stillDetector = useRef<Promise<PoseLandmarker> | null>(null);
  const [modelReady, setModelReady] = useState(false);

  const startCapture = useCallback(async () => {
    await requestMotionPermission(); // must run inside the tap on iOS; harmless elsewhere
    setStep('live');
    if (!liveDetector.current) {
      createPoseDetector('live').then((d) => { liveDetector.current = d; setModelReady(true); })
        .catch(() => setError(c.cameraError));
      stillDetector.current = createPoseDetector('still'); // warms up while the client gets into position
    }
  }, [c.cameraError]);

  useEffect(() => () => {
    liveDetector.current?.close();
    stillDetector.current?.then((d) => d.close()).catch(() => {});
  }, []);

  // ── live analysis loop ──
  const [live, setLive] = useState<{ landmarks: Landmark[] | null; frame: FrameChecks; still: boolean }>({
    landmarks: null, frame: { inFrame: false, facing: false }, still: false,
  });
  const history = useRef<Landmark[][]>([]);

  useEffect(() => {
    if (!cameraOn || !size || !modelReady || needsCalibration || busy) return;
    let raf = 0;
    let lastTs = 0;
    const loop = () => {
      const video = videoRef.current;
      const det = liveDetector.current;
      if (video && det && video.readyState >= 2) {
        const ts = Math.max(performance.now(), lastTs + 1); // timestamps must strictly increase
        lastTs = ts;
        const lms = toLandmarks(det.detectForVideo(video, ts));
        if (lms) {
          history.current = [...history.current.slice(-(HISTORY_FRAMES - 1)), lms];
          setLive({ landmarks: lms, frame: checkFrame(view, lms, size), still: isStill(history.current) });
        } else {
          history.current = [];
          setLive({ landmarks: null, frame: { inFrame: false, facing: false }, still: false });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cameraOn, size, modelReady, needsCalibration, busy, view, videoRef]);

  const levelOk = sensorMode ? !!sensor.level && isLevel(sensor.level) : referenceRoll !== null;
  const allOk = live.frame.inFrame && live.frame.facing && live.still && levelOk;

  // ── capture ──
  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !size || busy) return;
    const cameraCheck: CameraCheck | null = sensorMode
      ? sensor.level && { method: 'sensor', ...sensor.level }
      : referenceRoll !== null ? { method: 'reference', rollDeg: referenceRoll, pitchDeg: null } : null;
    if (!cameraCheck || !isLevel(cameraCheck)) { setError(c.notLevel); return; }

    setBusy(true);
    setError(null);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(size.width, size.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(size.width * scale);
      canvas.height = Math.round(size.height * scale);
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
      const det = await stillDetector.current!;
      const landmarks = toLandmarks(det.detect(canvas));
      if (!landmarks) { setError(c.noPerson); return; }
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
      if (!blob) { setError(c.noPerson); return; }
      setDraft({
        blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height,
        landmarks, edited: false, cameraCheck,
      });
      setStep('review');
    } finally {
      setBusy(false);
    }
  }, [videoRef, size, busy, sensorMode, sensor.level, referenceRoll, c.notLevel, c.noPerson]);

  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!allOk || busy || step !== 'live') { setCountdown(null); return; }
    setCountdown(COUNTDOWN_SECONDS);
    const id = window.setInterval(() => setCountdown((n) => (n === null ? null : n - 1)), 1000);
    return () => window.clearInterval(id);
  }, [allOk, busy, step]);
  useEffect(() => { if (countdown === 0) void capture(); }, [countdown, capture]);

  // Free photo memory when leaving the page.
  const urls = useRef<string[]>([]);
  useEffect(() => { if (draft) urls.current.push(draft.url); }, [draft]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function acceptDraft() {
    if (!draft) return;
    const next = { ...captures, [view]: draft };
    setCaptures(next);
    setDraft(null);
    const missing = POSTURE_VIEWS.findIndex((v) => !next[v]);
    if (missing === -1) setStep('summary');
    else { setViewIdx(missing); setStep('live'); }
    history.current = [];
  }

  function retakeView(idx: number) {
    setViewIdx(idx);
    setDraft(null);
    history.current = [];
    setStep('live');
  }

  function save() {
    const fd = new FormData();
    fd.set('payload', JSON.stringify({
      consent: true,
      note,
      views: POSTURE_VIEWS.map((v) => {
        const cap = captures[v]!;
        return {
          view: v, imageWidth: cap.width, imageHeight: cap.height,
          landmarks: cap.landmarks, landmarksEdited: cap.edited, cameraCheck: cap.cameraCheck,
        };
      }),
    }));
    for (const v of POSTURE_VIEWS) fd.set(`photo_${v}`, new File([captures[v]!.blob], `${v}.jpg`, { type: 'image/jpeg' }));
    setError(null);
    startSaving(async () => {
      const result = await savePostureAssessmentAction(patientId, fd); // redirects to the report on success
      if (result && !result.ok) setError(result.error);
    });
  }

  // ── render ──
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm text-muted-foreground">{patientName}</p>
      </div>

      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {step === 'setup' && (
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <h2 className="font-medium">{c.tipsTitle}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {c.tips.map((tip) => <li key={tip}>{tip}</li>)}
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{c.consent}</span>
          </label>
          <Button disabled={!consent} onClick={startCapture}>
            <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
            {c.start}
          </Button>
        </div>
      )}

      {step === 'live' && (
        <div className="space-y-3">
          {!needsCalibration && (
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">{p.views[view]} <span className="text-sm font-normal text-muted-foreground">· {c.step.replace('{n}', String(viewIdx + 1))}</span></p>
            </div>
          )}
          <p className="text-sm">{needsCalibration ? c.calibrateHelp : c.instructions[view]}</p>

          <div className="relative mx-auto overflow-hidden rounded-md bg-black" style={size ? stageStyle(size.width, size.height) : { aspectRatio: '3 / 4', width: 'min(100%, calc(70vh * 3 / 4))' }}>
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-contain" />
            {size && needsCalibration && (
              <Calibration width={size.width} height={size.height} onConfirm={(roll) => { setReferenceRoll(roll); setRecalibrating(false); }} c={c} />
            )}
            {size && !needsCalibration && (
              <OverlaySvg overlay={live.landmarks ? buildOverlay(view, live.landmarks, size.width, size.height) : { width: size.width, height: size.height, points: [], lines: [] }}>
                {/* framing guide: centre plumb line and head/heel margins */}
                <line x1={size.width / 2} x2={size.width / 2} y1={0} y2={size.height} stroke="#facc15" strokeOpacity={0.6} strokeWidth={size.width / 400} />
                <line x1={0} x2={size.width} y1={size.height * 0.02} y2={size.height * 0.02} stroke="#facc15" strokeOpacity={0.4} strokeWidth={size.width / 500} />
                <line x1={0} x2={size.width} y1={size.height * 0.98} y2={size.height * 0.98} stroke="#facc15" strokeOpacity={0.4} strokeWidth={size.width / 500} />
              </OverlaySvg>
            )}
            {sensorMode && sensor.level && !needsCalibration && (
              <div className="absolute left-2 top-2">
                <LevelIndicator
                  level={sensor.level}
                  label={c.sensorReading.replace('{roll}', sensor.level.rollDeg.toFixed(1)).replace('{pitch}', (sensor.level.pitchDeg ?? 0).toFixed(1))}
                />
              </div>
            )}
            {countdown !== null && countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-7xl font-bold text-white drop-shadow-lg">{countdown}</div>
            )}
            {(cameraError || !size || !modelReady || busy || sensor.supported === null) && (
              <div className="absolute inset-x-0 bottom-2 text-center text-xs text-white drop-shadow">
                {cameraError ? c.cameraError : busy ? c.processing : sensor.supported === null ? c.checkingSensor : c.loadingModel}
              </div>
            )}
          </div>

          {!needsCalibration && (
            <>
              <div className="flex flex-wrap gap-2">
                <CheckChip ok={live.frame.inFrame} label={c.checks.inFrame} />
                <CheckChip ok={live.frame.facing} label={c.checks.facing} />
                <CheckChip ok={live.still} label={c.checks.still} />
                <CheckChip ok={levelOk} label={c.checks.level} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void capture()} disabled={busy || !modelReady || !levelOk || !live.frame.inFrame}>
                  <Camera className="mr-2 h-4 w-4" aria-hidden="true" />
                  {c.capture}
                </Button>
                <Button variant="outline" onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}>
                  <SwitchCamera className="mr-2 h-4 w-4" aria-hidden="true" />
                  {c.switchCamera}
                </Button>
                {!sensorMode && sensor.supported === false && (
                  <Button variant="ghost" onClick={() => setRecalibrating(true)}>
                    <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                    {c.recalibrate}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {step === 'review' && draft && (
        <div className="space-y-3">
          <p className="font-medium">{p.views[view]}</p>
          <p className="text-sm text-muted-foreground">{c.reviewHelp}</p>
          <div className="mx-auto" style={stageStyle(draft.width, draft.height)}>
            <LandmarkEditor
              imageUrl={draft.url}
              width={draft.width}
              height={draft.height}
              view={view}
              landmarks={draft.landmarks}
              onChange={(landmarks) => setDraft({ ...draft, landmarks, edited: true })}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => retakeView(viewIdx)}>{c.retake}</Button>
            <Button onClick={acceptDraft}><Check className="mr-2 h-4 w-4" aria-hidden="true" />{c.usePhoto}</Button>
          </div>
        </div>
      )}

      {step === 'summary' && (
        <div className="space-y-4">
          <h2 className="font-medium">{c.summaryTitle}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {POSTURE_VIEWS.map((v, i) => {
              const cap = captures[v]!;
              return (
                <button key={v} type="button" onClick={() => retakeView(i)} className="space-y-1 text-left">
                  <div className="relative overflow-hidden rounded-md bg-black" style={{ aspectRatio: `${cap.width} / ${cap.height}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cap.url} alt={p.views[v]} className="absolute inset-0 h-full w-full object-contain" />
                    <OverlaySvg overlay={buildOverlay(v, cap.landmarks, cap.width, cap.height)} />
                  </div>
                  <p className="text-xs font-medium">{p.views[v]}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {cap.cameraCheck.method === 'sensor' ? c.cameraLevelSensor : c.cameraLevelReference}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label htmlFor="posture-note">{p.note}</Label>
            <Textarea id="posture-note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? c.saving : c.save}</Button>
        </div>
      )}
    </div>
  );
}

function CheckChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
      {ok ? <Check className="h-3 w-3" aria-hidden="true" /> : <X className="h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  );
}

/** Laptop calibration: drag a line onto a true vertical; camera roll must be within tolerance to continue. */
function Calibration({
  width,
  height,
  onConfirm,
  c,
}: {
  width: number;
  height: number;
  onConfirm: (rollDeg: number) => void;
  c: ReturnType<typeof useTranslations>['posture']['capture'];
}) {
  const [ends, setEnds] = useState([{ x: width * 0.5, y: height * 0.15 }, { x: width * 0.5, y: height * 0.85 }]);
  const roll = useMemo(() => rollFromReferenceLine(ends[0], ends[1]), [ends]);
  const ok = roll !== null && isLevel({ rollDeg: roll, pitchDeg: null });
  const message = roll === null
    ? c.calibrateInvalid
    : ok ? c.calibrateOk.replace('{deg}', roll.toFixed(1)) : c.calibrateTilted.replace('{deg}', Math.abs(roll).toFixed(1));

  return (
    <>
      <OverlaySvg overlay={{ width, height, points: [], lines: [] }} className="touch-none">
        <line x1={ends[0].x} y1={ends[0].y} x2={ends[1].x} y2={ends[1].y} stroke="#f97316" strokeWidth={width / 300} />
        <line x1={ends[0].x} y1={0} x2={ends[0].x} y2={height} stroke="#ffffff" strokeOpacity={0.5} strokeDasharray={`${width / 100} ${width / 150}`} strokeWidth={width / 600} />
        <DragHandles
          handles={ends.map((e, id) => ({ id, ...e }))}
          radius={width / 90}
          onMove={(id, x, y) => setEnds((prev) => prev.map((e, i) => (i === id ? { x, y } : e)))}
        />
      </OverlaySvg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 bg-black/60 p-3 text-center text-sm text-white">
        <p>{message}</p>
        <Button size="sm" disabled={!ok} onClick={() => roll !== null && onConfirm(roll)}>{c.confirmCalibration}</Button>
      </div>
    </>
  );
}
