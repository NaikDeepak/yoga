# Pawar Yoga Therapy — Patient Management, Phase 1 (MVP) Design

**Date:** 2026-06-11
**Status:** Approved (design review done in session)
**Source:** "Yoga Management Proposal.pdf" — 11-module Patient Management Web Application for Pawar Yoga Therapy Center

## Goal

Deliver a minimum usable product the therapist can use daily: register patients, record health problems, upload reports/prescriptions, write per-visit treatment notes, and print/export a patient summary PDF. Later phases add scheduling, dashboards, WhatsApp reminders, and fees.

## Phasing

| Phase | Proposal modules | Contents |
|---|---|---|
| **1 (this spec)** | M1, M2, M3, M5, M8, M11 (login basics) | Admin login, patient registration, health problems, document upload, treatment plan + visit notes, PDF export, patient search |
| 2 | M4, M6, M10 | Lifestyle assessment form, follow-up/appointment system, admin dashboard, weight & pain-scale charts |
| 3 | M7, M9, rest of M11 | WhatsApp/SMS reminders (Twilio), fees & payment tracking, CSV export, audit logs |

Phase 1 already captures weight and pain scale on every visit so Phase 2 charts have historical data.

## Architecture

- **One Next.js app** (App Router, TypeScript) — frontend + server actions/route handlers; no separate API server.
- **Supabase** — Postgres database, private Storage bucket for files, Auth for the single admin account (email + password).
- **Drizzle ORM** — typed schema and queries from the Next.js server (Supabase service role; no RLS complexity needed for a single-admin app).
- **Deployment** — Vercel (app) + Supabase free tier (data). HTTPS by default.
- **Language** — bilingual labels: English with Marathi alongside on key labels; the 18 preset ailments shown in Marathi as per the proposal.

## Data model

All tables have `id` (uuid, pk) and `created_at`.

### patients
- `patient_code` text unique — auto-generated `PYT-0001`, `PYT-0002`, … (zero-padded sequence)
- `full_name` text, required
- `photo_path` text nullable — path in Storage bucket
- `age` integer nullable, `gender` text nullable (male/female/other)
- `weight_kg` numeric nullable, `height_cm` numeric nullable — **BMI is computed, never stored** (live in form, derived on display)
- `mobile` text required, `email` text nullable
- `address` text nullable, `occupation` text nullable
- `emergency_contact` text nullable

### patient_problems
- `patient_id` fk → patients (cascade delete)
- `problem` text — one of the 18 presets (stored as the Marathi label) or custom text
- `is_custom` boolean default false
- `note` text nullable

Preset list (from proposal): कंबर दुखी, मान दुखी, सायटिका, थायरॉईड, PCOD/PCOS, डायबिटीस, बीपी, माइग्रेन, निद्रानाश, Anxiety, स्थूलता, गुडघे दुखी, स्लिप डिस्क, गॅसेस, बद्धकोष्ठता, सांधेदुखी, पाठ दुखी, स्ट्रेस — plus "इतर" (custom).

### documents
- `patient_id` fk → patients (cascade delete)
- `doc_type` text — MRI | X-Ray | Blood Report | Prescription | Other
- `file_path` text — path in Storage bucket
- `original_name` text, `mime_type` text, `size_bytes` integer

### treatment_plans
- `patient_id` fk → patients, unique (one active plan per patient)
- text fields: `yoga_program`, `pranayam`, `massage`, `yoga_therapy`, `diet_plan`, `medicines`, `panchkarma` — all nullable
- `updated_at`

### visits
- `patient_id` fk → patients (cascade delete)
- `visit_date` date required (defaults to today)
- `progress_note` text
- `weight_kg` numeric nullable
- `pain_scale` integer nullable (1–10)

## Screens

1. **/login** — Supabase email/password sign-in; everything else behind auth middleware.
2. **/patients** — list with search box filtering by name or mobile (server-side `ilike`), patient code + name + mobile + problem chips per row, "New Patient" button.
3. **/patients/new** — registration form: name, photo upload, age, gender, weight, height with **live BMI readout** (value + category), mobile, email, address, occupation, emergency contact. Patient code assigned server-side on create.
4. **/patients/[id]** — tabbed detail page:
   - **Overview** — registration info, photo, BMI, edit button.
   - **Problems** — checklist of 18 presets + add-custom field, optional note per problem.
   - **Documents** — upload (PDF/JPG/PNG, max 10 MB), typed list grouped by doc_type, view via short-lived signed URL, delete with confirmation.
   - **Treatment & Visits** — treatment plan form (7 text areas) and chronological visit log with "Add Visit" (date, note, weight, pain scale).
5. **/patients/[id]/print** — server-rendered A4 print view: registration + problems + treatment plan + visit history. "Download PDF" button on the detail page opens this view; print CSS makes the browser's *Save as PDF* produce a clean document. No Puppeteer/react-pdf dependency; can be swapped later if server-generated PDFs are needed.

## File storage

Single private Supabase bucket `patient-files`, paths `patients/{patient_id}/photo.*` and `patients/{patient_id}/documents/{uuid}-{original_name}`. All access via signed URLs generated server-side (60-minute expiry). Uploads validated for MIME type (pdf/jpeg/png) and size (≤10 MB) on both client and server.

## Validation & error handling

- Zod schemas shared between client forms and server actions; required-field errors shown inline with bilingual messages.
- Server actions return typed `{ ok, error }` results; UI shows a toast on failure — no silent failures.
- Upload failures surface the reason (too large / wrong type / network) and leave no orphan DB rows (insert document row only after storage upload succeeds; delete storage object if insert fails).

## Testing

- Unit: BMI computation + category, patient-code generation/padding, all Zod schemas.
- Integration (happy path per action): create/edit patient, add/remove problem, upload/delete document, save treatment plan, add visit.
- Manual checklist before handover: mobile responsiveness on the 5 screens, print view output on A4.

## Out of scope for Phase 1

Appointments/follow-ups, lifestyle assessment, dashboards/charts, WhatsApp/SMS, fees, CSV export, audit logs, multi-user roles, Marathi-only mode, Razorpay, mobile app — all deferred to Phases 2–3 or the proposal's "not included" list.
