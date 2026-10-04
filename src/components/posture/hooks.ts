'use client';

import { useEffect, useRef, useState } from 'react';
import { levelFromGravity, type Level } from '@/lib/posture-capture';

/** Live camera stream into a <video>. Resolution is whatever the device gives for the ideal 1080p ask. */
export function useCamera(facingMode: 'environment' | 'user', enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    setSize(null);
    setError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable (needs HTTPS)');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setSize({ width: video.videoWidth, height: video.videoHeight });
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, enabled]);

  return { videoRef, size, error };
}

type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iOS only delivers motion events after permission, and the request must come from a tap handler.
 * Elsewhere this resolves true immediately. False means no sensor access.
 */
export async function requestMotionPermission(): Promise<boolean> {
  const DME = window.DeviceMotionEvent as (typeof DeviceMotionEvent & MotionPermission) | undefined;
  if (!DME) return false;
  if (typeof DME.requestPermission !== 'function') return true;
  try {
    return (await DME.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Smoothed camera level from the gravity sensor while `enabled`.
 * `supported`: null while probing, false when no real gravity data arrives within 3 s (laptops).
 */
const SENSOR_PROBE_MS = 3000;

export function useDeviceLevel(enabled: boolean) {
  const [level, setLevel] = useState<Level | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const smooth = useRef<{ x: number; y: number; z: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x === null || g.y === null || g.z === null) return;
      const a = 0.2; // exponential smoothing; hand tremor otherwise makes the bubble jitter
      const prev = smooth.current;
      smooth.current = prev
        ? { x: prev.x + a * (g.x - prev.x), y: prev.y + a * (g.y - prev.y), z: prev.z + a * (g.z - prev.z) }
        : { x: g.x, y: g.y, z: g.z };
      const l = levelFromGravity(smooth.current);
      if (l) { setLevel(l); setSupported(true); }
    };
    window.addEventListener('devicemotion', onMotion);
    // Generous: a busy phone can be slow to fire the first event; a late event still flips to `true`.
    const probe = window.setTimeout(() => setSupported((s) => s ?? false), SENSOR_PROBE_MS);
    return () => { window.removeEventListener('devicemotion', onMotion); window.clearTimeout(probe); };
  }, [enabled]);

  return { level, supported };
}

/** Converts a pointer position to the SVG's viewBox coordinates. */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
