# PWA Installable App — Design

**Date:** 2026-07-17
**Status:** Approved
**Scope:** Make the existing web app installable on Android phones as a home-screen app (minimal PWA). No offline support, no app store, no native wrapper.

## Goal

Clinicians (Android, Chrome) install the app from the browser to their home screen. It launches full-screen with its own icon and no browser chrome. Nothing about auth, data flow, or patient data changes.

## Explicitly out of scope

- Service worker / offline support / asset caching (revisit only if real-world offline pain appears)
- iOS-specific install support (apple-touch-icon, splash screens)
- Play Store listing (Capacitor/TWA)
- Push notifications

## Design

### 1. Web app manifest

New file `src/app/manifest.ts` exporting a `MetadataRoute.Manifest`:

- `name`: `"Pawar Yoga Therapy"`
- `short_name`: `"PYT"` (home-screen label)
- `description`: short English description
- `start_url`: `"/"` — existing root already routes logged-out users to `/login`
- `display`: `"standalone"`
- `theme_color` / `background_color`: match current UI palette
- `icons`: 192×192, 512×512, and a 512×512 `purpose: "maskable"` entry

Next.js serves this at `/manifest.webmanifest` and links it automatically.

### 2. Icons

Generate from `public/pytc-logo.png` into `public/icons/`:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `icon-512-maskable.png` (512×512, logo scaled into the maskable safe zone with padding)

Generated once with a throwaway `sharp` script; script is not added to dependencies or committed.

### 3. Layout metadata

Add a `viewport` export with `themeColor` to `src/app/layout.tsx` so the Android status bar matches the app.

### 4. Install criteria

Chrome's installability requirements: HTTPS (Vercel ✅), manifest with name, icons ≥192px, `display: standalone`. Chrome no longer requires a service worker for installation. After deploy, Chrome shows the install prompt / "Add to Home Screen".

## Testing

- Unit test `tests/app/manifest.test.ts`: import the manifest function, assert `name`, `display === "standalone"`, and that icons include 192 and 512 sizes plus a maskable entry.
- Manual QA (append to `docs/setup.md` checklist): on Android Chrome against the deployed URL — install prompt appears, icon renders correctly (including maskable shape), app launches standalone, login flow works inside the installed app.

## Docs

- Add manifest/PWA line to the module map in `docs/architecture.md` (same commit as the code change, per repo convention).

## Rejected alternatives

- **PWA + service worker (Serwist):** faster repeat loads and an offline fallback page, but introduces cache-invalidation complexity against server actions and live patient data — stale-data risk in a medical app for no requested benefit.
- **Capacitor wrapper:** only needed for store presence or native APIs; neither is a goal.
