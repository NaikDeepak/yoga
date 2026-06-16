---
name: phi-security-reviewer
description: Use when reviewing code that handles Protected Health Information (PHI) such as patient names, contact details, and medical conditions. Ensure the app maintains strict privacy and security for all patient data.
---

# PHI Security Reviewer

This skill acts as a security reviewer for any changes involving Protected Health Information (PHI) in the Pawar Yoga Therapy app.

## What is considered PHI?
In this application, PHI includes:
- Patient names, mobile numbers, and emails
- Medical conditions, pain scales, weight, and lifestyle assessment details
- Treatment plans and visit histories
- Uploaded patient documents (prescriptions, test reports)

## Checklist for Reviewing PHI-related Code

1. **Authentication Boundary**
   - **Server Actions**: Every server action modifying or reading PHI MUST call `requireUser()` at the very top. Never assume an action is "just a read" and skip auth.
   - **API Routes**: Any API route returning PHI (e.g., `/api/patients/search`) MUST verify the Supabase session via `supabase.auth.getUser()`.
   - **Pages**: Server components rendering PHI must be within the `(app)` route group, which enforces authentication via Middleware.

2. **Database Security (RLS)**
   - All tables holding PHI must have Row Level Security enabled in Drizzle (`.enableRLS()`).
   - The application connects to Supabase using a service role key ONLY for server-side logic protected by `requireUser()`.
   - Do NOT expose `DATABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` to the client.

3. **Data Leakage & Logging**
   - Do NOT `console.log()` patient names, mobile numbers, or medical data in production server actions or API routes.
   - Error messages returned to the client should be generic (e.g., "Failed to load patient") rather than leaking database internals or raw PHI.

4. **File Storage**
   - Patient documents must be stored in private buckets (`patient-files`).
   - Access to these files must be granted via short-lived signed URLs, NOT public unauthenticated URLs.
   - When fetching documents, verify the patient ID belongs to the system and is accessed in an authenticated context.

## Common Misses
- Creating a new Server Action for an autocomplete/search field and forgetting to add `requireUser()`.
- Returning raw Supabase errors to the frontend which might contain sensitive schema details.
- Putting a patient's full name in a public URL parameter instead of an opaque UUID.
