# Language Pack & i18n System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all hardcoded bilingual "English / मराठी" strings with a typed translation system and add a Settings page where users can switch their language (persisted in DB + cookie).

**Architecture:** Six translation files handle the core i18n (`en.ts` defines the `Translations` type, `mr.ts` satisfies it, `translations.ts` is client-safe, `server.ts` reads the cookie). A React Context wraps the app shell so all client components call `useTranslations()`. Server components call `getTranslations(await getLocale())` directly. Language preference is stored in a new `user_preferences` DB table and cached in a `lang` cookie.

**Tech Stack:** Next.js 15 server components, Drizzle ORM + PGlite (tests), React Context, `next/headers` cookies (server-only).

## Global Constraints

- Locales: `'en' | 'mr'` only (union enforced by `LOCALES` constant)
- Cookie name: `lang`, `httpOnly: true`, `path: '/'`, `maxAge: 60 * 60 * 24 * 365`
- No external i18n library
- `next/headers` is server-only — NEVER import `server.ts` from any client component or file that a client component imports
- `translations.ts` is client-safe — it may only import from `./en` and `./mr`
- `context.tsx` must have `'use client'` directive and may only import from `./translations` (not `./server`)
- `mr.ts` must have type annotation `mr: Translations` — TypeScript enforces completeness at compile
- Template variables in strings use `{placeholder}` format; replace with `.replace('{placeholder}', value)`
- Every user-visible bilingual string (pattern: `'English / मराठी'`) must be replaced — no exceptions
- Coverage gate: `npm test` must pass after every task; `npm run typecheck` must pass after every task
- Test files: no test changes required — string content is not asserted in existing tests
- Commit message prefix: `feat:` for new capabilities, `refactor:` for string migrations

---

## File Map

**Created:**
- `src/lib/i18n/en.ts` — English strings + `Translations` type
- `src/lib/i18n/mr.ts` — Marathi strings, satisfies `Translations`
- `src/lib/i18n/translations.ts` — `getTranslations()`, `LOCALES`, `Locale` (client-safe)
- `src/lib/i18n/server.ts` — `getLocale()` (server-only)
- `src/lib/i18n/context.tsx` — `LocaleProvider`, `useTranslations()` (client)
- `src/data/preferences.ts` — `getUserLanguage()`, `setUserLanguage()`
- `src/actions/preferences.ts` — `saveLanguageAction()`
- `src/app/(app)/settings/page.tsx` — Settings page
- `tests/data/preferences.test.ts` — data layer tests
- `tests/actions/preferences.test.ts` — action tests

**Modified:**
- `src/db/schema.ts` — add `userPreferences` table + export
- `src/app/(app)/layout.tsx` — read locale from cookie/DB, pass to AppShell
- `src/components/AppShell.tsx` — add `locale` prop, wrap in `LocaleProvider`
- `src/components/Sidebar.tsx` — enable Settings link + string migration
- `src/app/(app)/dashboard/page.tsx` — string migration
- `src/app/(app)/patients/page.tsx` — string migration
- `src/app/(app)/patients/new/page.tsx` — string migration
- `src/app/(app)/patients/[id]/page.tsx` — string migration
- `src/app/(app)/patients/[id]/edit/page.tsx` — string migration
- `src/app/(app)/patients/[id]/print/page.tsx` — string migration
- `src/app/(app)/patients/[id]/receipt/page.tsx` — string migration
- `src/app/login/page.tsx` — string migration
- `src/app/register/page.tsx` — string migration
- `src/components/PatientForm.tsx` — string migration
- `src/components/PatientCard.tsx` — add `'use client'` + string migration
- `src/components/PatientHeader.tsx` — string migration
- `src/components/TreatmentPlanForm.tsx` — string migration
- `src/components/DeleteButton.tsx` — string migration
- `src/components/InlineForm.tsx` — string migration
- `src/components/BranchFilter.tsx` — string migration
- `src/components/GlobalSearch.tsx` — string migration
- `src/components/StopwatchWidget.tsx` — string migration

---

## Task 1: DB Schema + Preferences Data Layer

**Files:**
- Modify: `src/db/schema.ts`
- Create: `src/data/preferences.ts`
- Create: `tests/data/preferences.test.ts`

**Interfaces:**
- Produces: `getUserLanguage(db, userId): Promise<Locale>`, `setUserLanguage(db, userId, locale): Promise<void>`
- Consumes: `Locale` from `src/lib/i18n/translations.ts` (created in Task 2 — but `Locale` is just `'en' | 'mr'`, so you can define a local `type Locale = 'en' | 'mr'` in `preferences.ts` for Task 1 and replace with the import in Task 3 once the file exists)

- [ ] **Step 1: Write the failing tests**

Create `tests/data/preferences.test.ts`:

```ts

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { getUserLanguage, setUserLanguage } from '@/data/preferences';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

describe('getUserLanguage', () => {
  it('returns en when no preference row exists', async () => {
    expect(await getUserLanguage(db, 'user-123')).toBe('en');
  });

  it('returns saved language after setUserLanguage', async () => {
    await setUserLanguage(db, 'user-123', 'mr');
    expect(await getUserLanguage(db, 'user-123')).toBe('mr');
  });
});

describe('setUserLanguage', () => {
  it('upserts — calling twice updates, not duplicates', async () => {
    await setUserLanguage(db, 'user-123', 'mr');
    await setUserLanguage(db, 'user-123', 'en');
    expect(await getUserLanguage(db, 'user-123')).toBe('en');
  });
});

```

- [ ] **Step 2: Run tests to verify they fail**

```bash

npm test tests/data/preferences.test.ts

```

Expected: FAIL — `getUserLanguage` not found

- [ ] **Step 3: Add `userPreferences` table to schema**

In `src/db/schema.ts`, after the existing imports add to the schema (below the `feePayments` table, before the type exports at the end):

```ts

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey(),
  language: text('language').notNull().default('en'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type UserPreference = typeof userPreferences.$inferSelect;

```

- [ ] **Step 4: Generate and run migration**

```bash

npm run db:generate
npm run db:migrate

```

Expected: new migration file created in `drizzle/`, migration applied.

- [ ] **Step 5: Implement `src/data/preferences.ts`**

```ts

import { eq } from 'drizzle-orm';
import { userPreferences } from '@/db/schema';
import type { Db } from '@/db/types';

type Locale = 'en' | 'mr';

export async function getUserLanguage(db: Db, userId: string): Promise<Locale> {
  const [row] = await db
    .select({ language: userPreferences.language })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  if (!row) return 'en';
  return (row.language === 'mr' ? 'mr' : 'en') as Locale;
}

export async function setUserLanguage(db: Db, userId: string, locale: Locale): Promise<void> {
  await db
    .insert(userPreferences)
    .values({ userId, language: locale })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { language: locale, updatedAt: new Date() },
    });
}

```

- [ ] **Step 6: Run tests to verify they pass**

```bash

npm test tests/data/preferences.test.ts

```

Expected: PASS (3 tests)

- [ ] **Step 7: Run typecheck and full test suite**

```bash

npm run typecheck && npm test

```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash

git add src/db/schema.ts src/data/preferences.ts tests/data/preferences.test.ts drizzle/
git commit -m "feat: add user_preferences table and preferences data layer"

```

---

## Task 2: Translation Files

**Files:**
- Create: `src/lib/i18n/en.ts`
- Create: `src/lib/i18n/mr.ts`
- Create: `src/lib/i18n/translations.ts`
- Create: `src/lib/i18n/server.ts`

**Interfaces:**
- Produces: `Translations` type, `Locale` type, `LOCALES`, `getTranslations(locale): Translations`, `getLocale(): Promise<Locale>`
- Notes: A few keys extend the spec to cover strings found during code audit: `treatmentPlan.yogaTherapy`, `inlineForm.saved`, `inlineForm.genericError`, `deleteButton.deleting`, `patients.moreProblems`, `dashboard.weekdays`, `auth.wrongCredentials`, `auth.accountRegistered`, `auth.noAccount`, `auth.registerLink`

- [ ] **Step 1: Create `src/lib/i18n/en.ts`**

```ts

export const en = {
  common: {
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    search: 'Search',
    select: 'Select',
    loading: 'Loading…',
    noData: 'No data',
    pending: 'Pending',
    soon: 'Soon',
    optional: 'optional',
    register: 'Register',
    or: 'or',
  },
  nav: {
    dashboard: 'Dashboard',
    patients: 'Patients',
    calendar: 'Calendar',
    analytics: 'Analytics',
    settings: 'Settings',
    help: 'Help',
    logout: 'Logout',
    needHelp: 'Need Help?',
    needHelpBody: 'Contact support if you experience any issues with patient records.',
    contactSupport: 'Contact Support',
  },
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Manage your clinic, patients, and tasks with ease.',
    importData: 'Import Data',
    addPatient: 'Add Patient',
    totalPatients: 'Total Patients',
    visitsThisMonth: 'Visits This Month',
    increasedLastMonth: 'Increased from last month',
    highFrequency: 'High frequency',
    mostCommonAilment: 'Most Common Ailment',
    weeklyVisits: 'Weekly Patient Visits',
    reminders: 'Reminders',
    followUpsThisWeek: 'Follow-ups This Week',
    sendReminders: 'Send reminders to patients',
    noFollowUps: 'No follow-ups this week',
    sendMsg: 'Send Msg',
    viewAll: 'View all {count} follow-ups',
    weeksSchedule: "Week's Schedule",
    noVisitsThisWeek: 'No visits this week',
    pendingAssessments: 'Pending Assessments',
    allAssessmentsComplete: 'All assessments complete',
    ailmentBreakdown: 'Ailment Breakdown',
    noAilmentData: 'No ailment data yet',
    monthlyVisitGoal: 'Monthly Visit Goal',
    ofGoal: '% of goal',
    recentVisits: 'Recent Visits',
    noVisitsYet: 'No visits yet',
    patientName: 'Patient Name',
    patientId: 'Patient ID',
    date: 'Date',
    weight: 'Weight',
    painScale: 'Pain Scale',
    today: 'Today',
    tomorrow: 'Tomorrow',
    due: 'Due',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as readonly string[],
    pendingReason: {
      both: 'Lifestyle & treatment missing',
      lifestyle: 'Lifestyle missing',
      treatment: 'Treatment plan missing',
    },
  },
  patients: {
    title: 'Patients',
    registered: '{count} registered',
    newPatient: 'New Patient',
    searchPlaceholder: 'Search name or mobile',
    notFound: 'No patients found',
    registerFirst: 'Register first patient',
    newPatientTitle: 'New Patient',
    newPatientSubtitle: 'Register a new patient',
    moreProblems: '+{count} more',
  },
  patientDetail: {
    edit: 'Edit',
    report: 'Report',
    receipt: 'Receipt',
    tabs: {
      overview: 'Overview',
      problems: 'Problems',
      documents: 'Documents',
      treatment: 'Treatment & Visits',
      progress: 'Progress',
      fees: 'Fees',
      assessment: 'Assessment',
    },
    editTitle: 'Edit Patient',
    personal: 'Personal',
    age: 'Age',
    gender: 'Gender',
    occupation: 'Occupation',
    bodyMetrics: 'Body Metrics',
    weightKg: 'Weight',
    heightCm: 'Height',
    contact: 'Contact',
    mobile: 'Mobile',
    email: 'Email',
    emergency: 'Emergency',
    address: 'Address',
    assessmentSnapshot: 'Assessment Snapshot',
    editSnapshot: 'Edit →',
    fillSnapshot: 'Fill in →',
    noAssessment: 'No assessment filled yet',
    stress: 'Stress',
    sleepQuality: 'Sleep Quality',
    activity: 'Activity',
    goal: 'Goal',
    contraindicationsNoted: 'Contraindications noted',
  },
  problems: {
    title: 'Problems',
    noProblems: 'No problems recorded',
    presetLabel: 'Preset',
    noteLabel: 'Note',
    notePlaceholder: 'Optional note',
    addBtn: 'Add',
    otherProblem: 'Other problem',
    customPlaceholder: 'Type custom problem',
    addCustomBtn: 'Add custom',
  },
  documents: {
    title: 'Documents',
    typeLabel: 'Type',
    fileLabel: 'File (PDF/JPG/PNG, max 10MB)',
    uploadBtn: 'Upload',
    noDocs: 'No documents',
  },
  treatment: {
    title: 'Treatment & Visits',
    addVisit: 'Add Visit',
    visitDate: 'Date',
    visitWeight: 'Weight (kg)',
    visitPain: 'Pain (1–10)',
    nextVisit: 'Next visit',
    nextVisitOptional: 'optional',
    progressNote: 'Progress note',
    addVisitBtn: 'Add visit',
    noVisits: 'No visits yet',
  },
  progress: {
    title: 'Progress',
    weightTrend: 'Weight Trend',
    painTrend: 'Pain Trend',
    notEnoughData: 'Not enough data',
    firstVisit: 'First visit',
    latest: 'Latest',
    visitsWithData: 'Visits with data',
    weightChange: 'Weight change',
    painChange: 'Pain change',
  },
  fees: {
    title: 'Fees',
    courseFee: 'Course Fee',
    totalPaid: 'Total Paid',
    balanceDue: 'Balance Due',
    setCourseFee: 'Course Fee',
    totalCourseFee: 'Total Course Fee (₹)',
    setBtn: 'Set',
    recordPayment: 'Record Payment',
    amount: 'Amount (₹)',
    paymentDate: 'Date',
    note: 'Note',
    notePlaceholder: 'e.g. First instalment',
    addBtn: 'Add',
    paymentHistory: 'Payment History',
    noPayments: 'No payments recorded',
  },
  assessment: {
    title: 'Assessment',
    chip: {
      complete: 'Assessment ✓',
      partial: 'Assessment {filled}/5',
      missing: 'Assessment —',
    },
    primaryConcern: 'Primary Concern',
    chiefComplaint: 'What brings you here',
    duration: 'Since when',
    durationPlaceholder: 'e.g. 2 months',
    aggravatingFactors: 'What makes it worse',
    relievingFactors: 'What makes it better',
    previousTreatment: 'Previous treatments tried',
    medicationsTitle: 'Medications & Restrictions',
    currentMedications: 'Current medications',
    doctorDiagnosis: "Doctor's diagnosis",
    doctorRestrictions: "Doctor's restrictions",
    lifestyleTitle: 'Lifestyle',
    workType: 'Work type',
    workDesk: 'Desk job',
    workStanding: 'Standing',
    workPhysical: 'Physical labour',
    dailySitting: 'Daily sitting',
    activityLevel: 'Activity level',
    sedentary: 'Sedentary',
    light: 'Light',
    active: 'Active',
    sleepHours: 'Sleep hours',
    sleepQuality: 'Sleep quality',
    sleepQualityHint: '1 = poor, 10 = excellent',
    stressLevel: 'Stress level',
    stressLevelHint: '1 = calm, 10 = very stressed',
    screenTime: 'Screen time',
    exerciseTitle: 'Exercise History',
    previousExercise: 'Previous exercise',
    previousExercisePlaceholder: 'e.g. yoga, walking',
    fitnessLevel: 'Fitness level',
    fitnessBeginner: 'Beginner',
    fitnessIntermediate: 'Intermediate',
    fitnessActive: 'Active',
    fearOfMovement: 'Afraid movement worsens pain?',
    goalsTitle: 'Goals & Safety',
    primaryGoal: 'Primary goal',
    activityStruggle: 'Activity currently struggling with',
    activityStrugglePlaceholder: 'e.g. climbing stairs',
    hasContraindications: 'Any contraindications?',
    contraindicationDetails: 'Contraindication details',
    saveBtn: 'Save Assessment',
  },
  treatmentPlan: {
    title: 'Treatment Plan',
    yoga: 'Yoga Program',
    pranayam: 'Pranayam',
    yogaTherapy: 'Yoga Therapy',
    diet: 'Diet Plan',
    massage: 'Massage',
    panchkarma: 'Panchkarma',
    medicines: 'Medicines',
    progressNotes: 'Progress Notes',
    saveBtn: 'Save Plan',
    saving: 'Saving…',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Manage your preferences',
    languageTitle: 'Language',
    languageDescription: 'Choose your preferred language for the interface',
    saveBtn: 'Save Preferences',
    saved: 'Preferences saved',
    languages: {
      en: 'English',
      mr: 'मराठी',
    },
  },
  auth: {
    loginTitle: "Pawar's Yog Therapy",
    loginSubtitle: 'Admin Login',
    email: 'Email',
    password: 'Password',
    loginBtn: 'Sign In',
    loggingIn: 'Signing in…',
    wrongCredentials: 'Wrong email or password',
    accountRegistered: 'Account registered! Please sign in.',
    noAccount: "Don't have an account?",
    registerLink: 'Register',
    registerTitle: 'Create Account',
    registerBtn: 'Create Account',
  },
  stopwatch: {
    title: 'Session Timer',
    start: 'Start',
    pause: 'Pause',
    reset: 'Reset',
    pulseChecker: 'Pulse Checker',
    tapToMeasure: 'Tap to measure BPM',
    bpm: 'BPM',
    tapping: 'Tapping…',
    tapAgain: 'Tap again',
  },
  branchFilter: {
    allBranches: 'All branches',
  },
  globalSearch: {
    placeholder: 'Search for a patient…',
    noResults: 'No results',
  },
  form: {
    fullName: 'Full Name',
    mobile: 'Mobile',
    email: 'Email',
    address: 'Address',
    age: 'Age',
    gender: 'Gender',
    occupation: 'Occupation',
    weightKg: 'Weight (kg)',
    heightCm: 'Height (cm)',
    branch: 'Branch',
    emergencyContact: 'Emergency Contact',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',
    selectGender: 'Select gender',
    selectBranch: 'Select branch',
    photoLabel: 'Photo',
    personalInfo: 'Personal Info',
    bodyMetrics: 'Body Metrics',
    contactInfo: 'Contact Info',
    bmi: 'BMI',
  },
  print: {
    patientReport: 'Patient Report',
    generatedOn: 'Generated on',
  },
  receipt: {
    title: 'Payment Receipt',
  },
  deleteButton: {
    confirmDelete: 'Are you sure?',
    deleteBtn: 'Delete',
    cancelBtn: 'Cancel',
    deleting: 'Deleting…',
  },
  inlineForm: {
    submitting: 'Saving…',
    saved: 'Saved ✓',
    genericError: 'Something went wrong. Please try again.',
    errorPrefix: 'Error:',
  },
} as const;

export type Translations = typeof en;

```

- [ ] **Step 2: Create `src/lib/i18n/mr.ts`**

```ts

import type { Translations } from './en';

export const mr: Translations = {
  common: {
    save: 'जतन करा',
    saving: 'जतन होत आहे…',
    cancel: 'रद्द करा',
    add: 'जोडा',
    edit: 'बदला',
    delete: 'काढा',
    remove: 'काढा',
    search: 'शोधा',
    select: 'निवडा',
    loading: 'लोड होत आहे…',
    noData: 'माहिती नाही',
    pending: 'प्रलंबित',
    soon: 'लवकरच',
    optional: 'ऐच्छिक',
    register: 'नोंदणी करा',
    or: 'किंवा',
  },
  nav: {
    dashboard: 'डॅशबोर्ड',
    patients: 'रुग्ण',
    calendar: 'दिनदर्शिका',
    analytics: 'विश्लेषण',
    settings: 'सेटिंग्ज',
    help: 'मदत',
    logout: 'बाहेर पडा',
    needHelp: 'मदत हवी आहे?',
    needHelpBody: 'रुग्ण नोंदींमध्ये समस्या येत असल्यास समर्थनाशी संपर्क साधा.',
    contactSupport: 'समर्थनाशी संपर्क करा',
  },
  dashboard: {
    title: 'डॅशबोर्ड',
    subtitle: 'आपले क्लिनिक, रुग्ण आणि कार्ये सहजपणे व्यवस्थापित करा.',
    importData: 'डेटा आयात करा',
    addPatient: 'रुग्ण जोडा',
    totalPatients: 'एकूण रुग्ण',
    visitsThisMonth: 'या महिन्यातील भेटी',
    increasedLastMonth: 'गेल्या महिन्यापेक्षा वाढ',
    highFrequency: 'उच्च वारंवारता',
    mostCommonAilment: 'सर्वात सामान्य आजार',
    weeklyVisits: 'साप्ताहिक रुग्ण भेटी',
    reminders: 'स्मरणपत्रे',
    followUpsThisWeek: 'या आठवड्यातील फॉलो-अप',
    sendReminders: 'रुग्णांना स्मरणपत्रे पाठवा',
    noFollowUps: 'या आठवड्यात फॉलो-अप नाहीत',
    sendMsg: 'संदेश पाठवा',
    viewAll: 'सर्व {count} फॉलो-अप पहा',
    weeksSchedule: 'आठवड्याचे वेळापत्रक',
    noVisitsThisWeek: 'या आठवड्यात भेटी नाहीत',
    pendingAssessments: 'प्रलंबित मूल्यमापने',
    allAssessmentsComplete: 'सर्व मूल्यमापने पूर्ण',
    ailmentBreakdown: 'आजारांचे विश्लेषण',
    noAilmentData: 'अद्याप आजाराचा डेटा नाही',
    monthlyVisitGoal: 'मासिक भेट उद्दिष्ट',
    ofGoal: '% उद्दिष्ट',
    recentVisits: 'अलीकडील भेटी',
    noVisitsYet: 'अद्याप भेटी नाहीत',
    patientName: 'रुग्णाचे नाव',
    patientId: 'रुग्ण ओळखपत्र',
    date: 'तारीख',
    weight: 'वजन',
    painScale: 'वेदना मोजमाप',
    today: 'आज',
    tomorrow: 'उद्या',
    due: 'देय',
    weekdays: ['रवि', 'सोम', 'मंगळ', 'बुध', 'गुरु', 'शुक्र', 'शनि'] as readonly string[],
    pendingReason: {
      both: 'जीवनशैली आणि उपचार कमी',
      lifestyle: 'जीवनशैली कमी',
      treatment: 'उपचार योजना कमी',
    },
  },
  patients: {
    title: 'रुग्ण',
    registered: '{count} नोंदणीकृत',
    newPatient: 'नवीन रुग्ण',
    searchPlaceholder: 'नाव किंवा मोबाईल शोधा',
    notFound: 'रुग्ण सापडले नाहीत',
    registerFirst: 'पहिला रुग्ण नोंदवा',
    newPatientTitle: 'नवीन रुग्ण',
    newPatientSubtitle: 'नवीन रुग्ण नोंदवा',
    moreProblems: '+{count} अधिक',
  },
  patientDetail: {
    edit: 'बदला',
    report: 'अहवाल',
    receipt: 'पावती',
    tabs: {
      overview: 'माहिती',
      problems: 'आजार',
      documents: 'कागदपत्रे',
      treatment: 'उपचार आणि भेटी',
      progress: 'प्रगती',
      fees: 'शुल्क',
      assessment: 'मूल्यमापन',
    },
    editTitle: 'रुग्ण संपादित करा',
    personal: 'वैयक्तिक',
    age: 'वय',
    gender: 'लिंग',
    occupation: 'व्यवसाय',
    bodyMetrics: 'शरीर मापे',
    weightKg: 'वजन',
    heightCm: 'उंची',
    contact: 'संपर्क',
    mobile: 'मोबाईल',
    email: 'ईमेल',
    emergency: 'आणीबाणी',
    address: 'पत्ता',
    assessmentSnapshot: 'मूल्यमापन सारांश',
    editSnapshot: 'संपादित करा →',
    fillSnapshot: 'भरा →',
    noAssessment: 'अद्याप मूल्यमापन भरले नाही',
    stress: 'ताण',
    sleepQuality: 'झोपेची गुणवत्ता',
    activity: 'शारीरिक हालचाल',
    goal: 'उद्दिष्ट',
    contraindicationsNoted: 'विरोधाभास नोंदवले',
  },
  problems: {
    title: 'समस्या',
    noProblems: 'कोणत्याही समस्या नोंदवल्या नाहीत',
    presetLabel: 'पूर्वनिर्धारित',
    noteLabel: 'टीप',
    notePlaceholder: 'ऐच्छिक टीप',
    addBtn: 'जोडा',
    otherProblem: 'इतर समस्या',
    customPlaceholder: 'सानुकूल समस्या लिहा',
    addCustomBtn: 'सानुकूल जोडा',
  },
  documents: {
    title: 'कागदपत्रे',
    typeLabel: 'प्रकार',
    fileLabel: 'फाइल (PDF/JPG/PNG, जास्तीत जास्त 10MB)',
    uploadBtn: 'अपलोड करा',
    noDocs: 'कागदपत्रे नाहीत',
  },
  treatment: {
    title: 'उपचार आणि भेटी',
    addVisit: 'भेट जोडा',
    visitDate: 'तारीख',
    visitWeight: 'वजन (किग्रा)',
    visitPain: 'वेदना (1–10)',
    nextVisit: 'पुढील भेट',
    nextVisitOptional: 'ऐच्छिक',
    progressNote: 'प्रगती टीप',
    addVisitBtn: 'भेट जोडा',
    noVisits: 'अद्याप भेटी नाहीत',
  },
  progress: {
    title: 'प्रगती',
    weightTrend: 'वजन ट्रेंड',
    painTrend: 'वेदना ट्रेंड',
    notEnoughData: 'पुरेसा डेटा नाही',
    firstVisit: 'पहिली भेट',
    latest: 'नवीनतम',
    visitsWithData: 'डेटासह भेटी',
    weightChange: 'वजनातील बदल',
    painChange: 'वेदनेतील बदल',
  },
  fees: {
    title: 'शुल्क',
    courseFee: 'कोर्स शुल्क',
    totalPaid: 'एकूण भरलेले',
    balanceDue: 'शिल्लक रक्कम',
    setCourseFee: 'कोर्स शुल्क',
    totalCourseFee: 'एकूण कोर्स शुल्क (₹)',
    setBtn: 'सेट करा',
    recordPayment: 'देयक नोंदवा',
    amount: 'रक्कम (₹)',
    paymentDate: 'तारीख',
    note: 'टीप',
    notePlaceholder: 'उदा. पहिला हप्ता',
    addBtn: 'जोडा',
    paymentHistory: 'देयक इतिहास',
    noPayments: 'कोणतेही देयक नोंदवले नाही',
  },
  assessment: {
    title: 'मूल्यमापन',
    chip: {
      complete: 'मूल्यमापन ✓',
      partial: 'मूल्यमापन {filled}/5',
      missing: 'मूल्यमापन —',
    },
    primaryConcern: 'मुख्य समस्या',
    chiefComplaint: 'आपण येथे का आलात',
    duration: 'कधीपासून',
    durationPlaceholder: 'उदा. 2 महिने',
    aggravatingFactors: 'काय त्रास वाढवते',
    relievingFactors: 'काय आराम देते',
    previousTreatment: 'आधी केलेले उपचार',
    medicationsTitle: 'औषधे आणि निर्बंध',
    currentMedications: 'सद्य औषधे',
    doctorDiagnosis: 'डॉक्टरांचे निदान',
    doctorRestrictions: 'डॉक्टरांचे निर्बंध',
    lifestyleTitle: 'जीवनशैली',
    workType: 'कामाचा प्रकार',
    workDesk: 'बैठक काम',
    workStanding: 'उभे राहून',
    workPhysical: 'शारीरिक श्रम',
    dailySitting: 'दैनिक बसणे',
    activityLevel: 'शारीरिक हालचाल',
    sedentary: 'बैठी जीवनशैली',
    light: 'हलकी',
    active: 'सक्रिय',
    sleepHours: 'झोपेचे तास',
    sleepQuality: 'झोपेची गुणवत्ता',
    sleepQualityHint: '1 = खराब, 10 = उत्कृष्ट',
    stressLevel: 'ताण पातळी',
    stressLevelHint: '1 = शांत, 10 = खूप तणावग्रस्त',
    screenTime: 'स्क्रीन वेळ',
    exerciseTitle: 'व्यायामाचा इतिहास',
    previousExercise: 'आधीचा व्यायाम',
    previousExercisePlaceholder: 'उदा. योग, चालणे',
    fitnessLevel: 'तंदुरुस्ती पातळी',
    fitnessBeginner: 'नवशिक्या',
    fitnessIntermediate: 'मध्यम',
    fitnessActive: 'सक्रिय',
    fearOfMovement: 'हालचालीने वेदना वाढण्याची भीती?',
    goalsTitle: 'उद्दिष्टे आणि सुरक्षितता',
    primaryGoal: 'मुख्य उद्दिष्ट',
    activityStruggle: 'सध्या कठीण वाटणारी क्रिया',
    activityStrugglePlaceholder: 'उदा. जिना चढणे',
    hasContraindications: 'कोणते विरोधाभास आहेत का?',
    contraindicationDetails: 'विरोधाभासाचे तपशील',
    saveBtn: 'मूल्यमापन जतन करा',
  },
  treatmentPlan: {
    title: 'उपचार योजना',
    yoga: 'योग कार्यक्रम',
    pranayam: 'प्राणायाम',
    yogaTherapy: 'योग थेरपी',
    diet: 'आहार योजना',
    massage: 'मालिश',
    panchkarma: 'पंचकर्म',
    medicines: 'औषधे',
    progressNotes: 'प्रगती नोंदी',
    saveBtn: 'योजना जतन करा',
    saving: 'जतन होत आहे…',
  },
  settings: {
    title: 'सेटिंग्ज',
    subtitle: 'आपल्या प्राधान्यक्रमांचे व्यवस्थापन करा',
    languageTitle: 'भाषा',
    languageDescription: 'इंटरफेससाठी आपली पसंतीची भाषा निवडा',
    saveBtn: 'प्राधान्यक्रम जतन करा',
    saved: 'प्राधान्यक्रम जतन केले',
    languages: {
      en: 'English',
      mr: 'मराठी',
    },
  },
  auth: {
    loginTitle: 'पावरचे योग थेरपी',
    loginSubtitle: 'प्रवेश',
    email: 'ईमेल',
    password: 'पासवर्ड',
    loginBtn: 'साइन इन करा',
    loggingIn: 'साइन इन होत आहे…',
    wrongCredentials: 'चुकीचा ईमेल किंवा पासवर्ड',
    accountRegistered: 'खाते नोंदणीकृत झाले! कृपया साइन इन करा.',
    noAccount: 'खाते नाही?',
    registerLink: 'नोंदणी करा',
    registerTitle: 'खाते तयार करा',
    registerBtn: 'खाते तयार करा',
  },
  stopwatch: {
    title: 'सत्र टायमर',
    start: 'सुरू करा',
    pause: 'थांबवा',
    reset: 'रीसेट करा',
    pulseChecker: 'नाडी तपासक',
    tapToMeasure: 'BPM मोजण्यासाठी टॅप करा',
    bpm: 'BPM',
    tapping: 'टॅप होत आहे…',
    tapAgain: 'पुन्हा टॅप करा',
  },
  branchFilter: {
    allBranches: 'सर्व शाखा',
  },
  globalSearch: {
    placeholder: 'रुग्णाचा शोध घ्या…',
    noResults: 'कोणतेही निकाल नाहीत',
  },
  form: {
    fullName: 'पूर्ण नाव',
    mobile: 'मोबाईल',
    email: 'ईमेल',
    address: 'पत्ता',
    age: 'वय',
    gender: 'लिंग',
    occupation: 'व्यवसाय',
    weightKg: 'वजन (किग्रा)',
    heightCm: 'उंची (सें.मी.)',
    branch: 'शाखा',
    emergencyContact: 'आणीबाणी संपर्क',
    genderMale: 'पुरुष',
    genderFemale: 'महिला',
    genderOther: 'इतर',
    selectGender: 'लिंग निवडा',
    selectBranch: 'शाखा निवडा',
    photoLabel: 'फोटो',
    personalInfo: 'वैयक्तिक माहिती',
    bodyMetrics: 'शरीर मापे',
    contactInfo: 'संपर्क माहिती',
    bmi: 'BMI',
  },
  print: {
    patientReport: 'रुग्ण अहवाल',
    generatedOn: 'तयार केले',
  },
  receipt: {
    title: 'देयक पावती',
  },
  deleteButton: {
    confirmDelete: 'आपण खात्री आहात का?',
    deleteBtn: 'काढा',
    cancelBtn: 'रद्द करा',
    deleting: 'काढत आहे…',
  },
  inlineForm: {
    submitting: 'जतन होत आहे…',
    saved: 'जतन झाले ✓',
    genericError: 'काहीतरी चुकले. पुन्हा प्रयत्न करा.',
    errorPrefix: 'त्रुटी:',
  },
};

```

- [ ] **Step 3: Create `src/lib/i18n/translations.ts`**

```ts

import { en } from './en';
import { mr } from './mr';
import type { Translations } from './en';

export { type Translations };
export const LOCALES = ['en', 'mr'] as const;
export type Locale = typeof LOCALES[number];

const localeMap: Record<Locale, Translations> = { en, mr };

export function getTranslations(locale: Locale): Translations {
  return localeMap[locale];
}

```

- [ ] **Step 4: Create `src/lib/i18n/server.ts`**

```ts

import { cookies } from 'next/headers';
import { LOCALES, type Locale } from './translations';

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value;
  return (LOCALES as readonly string[]).includes(lang ?? '') ? (lang as Locale) : 'en';
}

```

- [ ] **Step 5: Run typecheck**

```bash

npm run typecheck

```

Expected: PASS. If TypeScript reports missing keys in mr.ts, fix them.

- [ ] **Step 6: Run full test suite**

```bash

npm test

```

Expected: all existing tests pass (translation files have no test — type system is the check).

- [ ] **Step 7: Commit**

```bash

git add src/lib/i18n/
git commit -m "feat: add i18n translation files (en, mr) and core helpers"

```

---

## Task 3: Context + AppShell Wiring

**Files:**
- Create: `src/lib/i18n/context.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: `LocaleProvider`, `Locale` (Task 2), `getUserLanguage` (Task 1), `getLocale` (Task 2)
- Produces: `useTranslations()` hook available in all client components inside the app shell

- [ ] **Step 1: Create `src/lib/i18n/context.tsx`**

```tsx

'use client';

import { createContext, useContext } from 'react';
import { en } from './en';
import type { Translations } from './en';
import type { Locale } from './translations';
import { getTranslations } from './translations';

const LocaleContext = createContext<Translations>(en);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={getTranslations(locale)}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslations(): Translations {
  return useContext(LocaleContext);
}

```

- [ ] **Step 2: Update `src/app/(app)/layout.tsx`**

Replace the entire file content:

```ts

import { requireUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { countPatients } from '@/data/patients';
import { getUserLanguage } from '@/data/preferences';
import { getLocale } from '@/lib/i18n/server';
import { AppShell } from '@/components/AppShell';
import type { Locale } from '@/lib/i18n/translations';
import { cookies } from 'next/headers';
import { LOCALES } from '@/lib/i18n/translations';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, patientCount] = await Promise.all([
    requireUser(),
    countPatients(getDb()),
  ]);

  // Resolve locale: cookie is authoritative (set by saveLanguageAction).
  // On first load on a new device, the cookie is absent — fall back to DB preference.
  const cookieStore = await cookies();
  const langCookie = cookieStore.get('lang')?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(langCookie ?? '')
    ? (langCookie as Locale)
    : await getUserLanguage(getDb(), user.id);

  return (
    <AppShell userEmail={user.email ?? null} patientCount={patientCount} locale={locale}>
      {children}
    </AppShell>
  );
}

```

- [ ] **Step 3: Update `src/components/AppShell.tsx`**

Add `locale` prop and wrap content in `LocaleProvider`. Replace the existing file:

```tsx

'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { TopNav } from '@/components/TopNav';
import { StopwatchWidget } from '@/components/StopwatchWidget';
import { LocaleProvider } from '@/lib/i18n/context';
import type { Locale } from '@/lib/i18n/translations';

interface AppShellProps {
  children: React.ReactNode;
  userEmail: string | null;
  patientCount: number;
  locale: Locale;
}

export function AppShell({ children, userEmail, patientCount, locale }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <LocaleProvider locale={locale}>
      <div className="flex h-screen w-full overflow-hidden bg-muted/20">
        <aside className="hidden lg:block w-64 shrink-0 shadow-sm z-30">
          <Sidebar patientCount={patientCount} />
        </aside>

        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:hidden ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar patientCount={patientCount} onClose={() => setIsSidebarOpen(false)} />
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden relative">
          <TopNav
            userEmail={userEmail}
            onMenuClick={() => setIsSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-6xl">
              {children}
            </div>
          </main>
        </div>

        <StopwatchWidget />
      </div>
    </LocaleProvider>
  );
}

```

- [ ] **Step 4: Run typecheck**

```bash

npm run typecheck

```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

```bash

npm test

```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash

git add src/lib/i18n/context.tsx src/app/\(app\)/layout.tsx src/components/AppShell.tsx
git commit -m "feat: wire LocaleProvider into AppShell; resolve locale in app layout"

```

---

## Task 4: Settings Action + Settings Page

**Files:**
- Create: `src/actions/preferences.ts`
- Create: `tests/actions/preferences.test.ts`
- Create: `src/app/(app)/settings/page.tsx`
- Modify: `src/components/Sidebar.tsx` (enable Settings link only — full string migration in Task 6)

**Interfaces:**
- Consumes: `setUserLanguage` (Task 1), `getLocale` (Task 2), `getTranslations` (Task 2), `useTranslations` (Task 3)
- Produces: `saveLanguageAction(locale)` server action; `/settings` route

- [ ] **Step 1: Write failing tests for the action**

Create `tests/actions/preferences.test.ts`:

```ts

import { describe, it, expect, beforeEach } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb } from '../helpers/action-mocks';
import { saveLanguageAction } from '@/actions/preferences';
import { getUserLanguage } from '@/data/preferences';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await freshTestDb(); });

describe('saveLanguageAction', () => {
  it('persists a valid locale to the DB', async () => {
    await saveLanguageAction('mr');
    expect(await getUserLanguage(db, 'admin')).toBe('mr');
  });

  it('rejects an invalid locale', async () => {
    await expect(saveLanguageAction('hi' as 'en' | 'mr')).rejects.toThrow(/Invalid locale/);
  });
});

```

- [ ] **Step 2: Run tests to verify they fail**

```bash

npm test tests/actions/preferences.test.ts

```

Expected: FAIL — `saveLanguageAction` not found

- [ ] **Step 3: Create `src/actions/preferences.ts`**

```ts

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { setUserLanguage } from '@/data/preferences';
import { LOCALES, type Locale } from '@/lib/i18n/translations';

export async function saveLanguageAction(locale: Locale): Promise<void> {
  if (!(LOCALES as readonly string[]).includes(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }
  const user = await requireUser();
  await setUserLanguage(getDb(), user.id, locale);
  const cookieStore = await cookies();
  cookieStore.set('lang', locale, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
}

```

- [ ] **Step 4: Run tests to verify they pass**

```bash

npm test tests/actions/preferences.test.ts

```

Expected: PASS (2 tests)

- [ ] **Step 5: Create `src/app/(app)/settings/page.tsx`**

```tsx

import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import { saveLanguageAction } from '@/actions/preferences';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LOCALES } from '@/lib/i18n/translations';

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getTranslations(locale);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} />

      <Card className="rounded-2xl shadow-sm border-border max-w-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t.settings.languageTitle}</CardTitle>
          <CardDescription>{t.settings.languageDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              'use server';
              const selected = formData.get('locale') as string;
              if ((LOCALES as readonly string[]).includes(selected)) {
                await saveLanguageAction(selected as typeof LOCALES[number]);
              }
            }}
            className="space-y-4"
          >
            <div className="flex flex-col gap-3">
              {LOCALES.map((loc) => (
                <label
                  key={loc}
                  className="flex items-center gap-3 cursor-pointer rounded-xl border border-border p-4 hover:bg-accent/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input
                    type="radio"
                    name="locale"
                    value={loc}
                    defaultChecked={loc === locale}
                    className="accent-primary h-4 w-4"
                  />
                  <span className="font-medium text-sm">{t.settings.languages[loc]}</span>
                </label>
              ))}
            </div>
            <Button type="submit" className="rounded-full px-6">
              {t.settings.saveBtn}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

```

- [ ] **Step 6: Enable Settings link in `src/components/Sidebar.tsx`**

Find the `menuItems` array. Change the Settings entry from:

```ts

{ name: 'Settings', href: '#', icon: Settings, disabled: true },

```

to (this is in the `generalItems` array — locate the correct array):

In the `generalItems` array, find:

```ts

{ name: 'Settings', href: '#', icon: Settings, disabled: true },

```

Replace with:

```ts

{ name: 'Settings', href: '/settings', icon: Settings },

```

- [ ] **Step 7: Run typecheck and full test suite**

```bash

npm run typecheck && npm test

```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash

git add src/actions/preferences.ts tests/actions/preferences.test.ts src/app/\(app\)/settings/ src/components/Sidebar.tsx
git commit -m "feat: add saveLanguageAction, Settings page, and enable Settings nav link"

```

---

## Task 5: Server Component String Migration

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`
- Modify: `src/app/(app)/patients/page.tsx`
- Modify: `src/app/(app)/patients/new/page.tsx`
- Modify: `src/app/(app)/patients/[id]/page.tsx`
- Modify: `src/app/(app)/patients/[id]/edit/page.tsx`
- Modify: `src/app/(app)/patients/[id]/print/page.tsx`
- Modify: `src/app/(app)/patients/[id]/receipt/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`

**Pattern for all server component pages:**

```ts

import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

// Inside the async function:
const t = getTranslations(await getLocale());
// Then use t.section.key everywhere

```

**Template variable replacement pattern:**

```ts

t.patients.registered.replace('{count}', String(totalCount))
t.assessment.chip.partial.replace('{filled}', String(filled))
t.dashboard.viewAll.replace('{count}', String(followUps.length))

```

- [ ] **Step 1: Migrate `src/app/(app)/dashboard/page.tsx`**

Add imports at top:

```ts

import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

```

Replace the `WEEKDAYS` constant and related helpers with locale-aware versions inside `DashboardPage`:

```ts

export default async function DashboardPage({ ... }) {
  const t = getTranslations(await getLocale());
  // ... existing data fetching ...

```

Replace `dateHeaderLabel` to accept `t`:

```ts

function dateHeaderLabel(date: string, today: string, tomorrow: string, t: ReturnType<typeof getTranslations>): string {
  if (date === today) return t.dashboard.today;
  if (date === tomorrow) return t.dashboard.tomorrow;
  const [year, month, day] = date.split('-').map(Number);
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekday = t.dashboard.weekdays[dayIndex];
  const dateStr = formatDueDate(date);
  return `${weekday}, ${dateStr}`;
}

```

Replace `groupFollowUps` call to pass `t`:

```ts

function groupFollowUps(followUps: FollowUp[], t: ReturnType<typeof getTranslations>): AgendaRow[] {
  const today = getISTDateString(0);
  const tomorrow = getISTDateString(1);
  const rows: AgendaRow[] = [];
  let lastDate: string | null = null;
  for (const f of followUps) {
    if (f.nextVisitDate !== lastDate) {
      rows.push({ kind: 'header', label: dateHeaderLabel(f.nextVisitDate, today, tomorrow, t) });
      lastDate = f.nextVisitDate;
    }
    rows.push({ kind: 'item', followUp: f });
  }
  return rows;
}

```

Replace `pendingReason` function:

```ts

function pendingReason(missingLifestyle: boolean, missingTreatment: boolean, t: ReturnType<typeof getTranslations>): string {
  if (missingLifestyle && missingTreatment) return t.dashboard.pendingReason.both;
  if (missingLifestyle) return t.dashboard.pendingReason.lifestyle;
  return t.dashboard.pendingReason.treatment;
}

```

Replace all UI strings — examples:

```tsx

// Header
<h1 ...>{t.dashboard.title}</h1>
<p ...>{t.dashboard.subtitle}</p>
// Buttons
Import Data → {t.dashboard.importData}
Add Patient → {t.dashboard.addPatient}
// Stat cards
Total Patients → {t.dashboard.totalPatients}
Visits This Month → {t.dashboard.visitsThisMonth}
Increased from last month → {t.dashboard.increasedLastMonth}
High frequency → {t.dashboard.highFrequency}
Most Common Ailment → {t.dashboard.mostCommonAilment}
// Analytics
Weekly Patient Visits → {t.dashboard.weeklyVisits}
Reminders → {t.dashboard.reminders}
Follow-ups This Week → {t.dashboard.followUpsThisWeek}
Send reminders to patients → {t.dashboard.sendReminders}
No follow-ups / ... → {t.dashboard.noFollowUps}
Send Msg → {t.dashboard.sendMsg}
View all {n} follow-ups → {t.dashboard.viewAll.replace('{count}', String(followUps.length))}
Week's Schedule → {t.dashboard.weeksSchedule}
No visits this week → {t.dashboard.noVisitsThisWeek}
Pending Assessments → {t.dashboard.pendingAssessments}
All assessments complete / ... → {t.dashboard.allAssessmentsComplete}
Ailment Breakdown → {t.dashboard.ailmentBreakdown}
No ailment data yet → {t.dashboard.noAilmentData}
Monthly Visit Goal → {t.dashboard.monthlyVisitGoal}
% of goal (inside SVG) → {Math.round(pct * 100)}{t.dashboard.ofGoal}
Recent Visits → {t.dashboard.recentVisits}
No visits yet / ... → {t.dashboard.noVisitsYet}
Patient Name → {t.dashboard.patientName}
Patient ID → {t.dashboard.patientId}
Date → {t.dashboard.date}
Weight → {t.dashboard.weight}
Pain Scale → {t.dashboard.painScale}
Due: {date} → {t.dashboard.due}: {date}
Pending badge → {t.common.pending}

```

Also pass `t` to `pendingReason` calls: `pendingReason(p.missingLifestyle, p.missingTreatment, t)`
And pass `t` to `groupFollowUps`: `groupFollowUps(followUps, t)`

- [ ] **Step 2: Migrate `src/app/(app)/patients/page.tsx`**

Add:

```ts

import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

```

Inside `PatientsPage`:

```ts

const t = getTranslations(await getLocale());

```

Replacements:

```tsx

title="Patients / रुग्ण" → title={t.patients.title}
subtitle={`${totalCount} registered`} → subtitle={t.patients.registered.replace('{count}', String(totalCount))}
New Patient / नवीन रुग्ण → {t.patients.newPatient}
placeholder="Search name or mobile / ..." → placeholder={t.patients.searchPlaceholder}
aria-label="Search patients" → aria-label={t.patients.searchPlaceholder}
No patients found / ... → {t.patients.notFound}
Register first patient / ... → {t.patients.registerFirst}

```

- [ ] **Step 3: Migrate `src/app/(app)/patients/new/page.tsx`**

Add import + `const t = getTranslations(await getLocale())`:

```tsx

title={t.patients.newPatientTitle}
subtitle={t.patients.newPatientSubtitle}
submitLabel={t.patients.newPatient}

```

- [ ] **Step 4: Migrate `src/app/(app)/patients/[id]/page.tsx`**

Add import + `const t = getTranslations(await getLocale())`.

Replace the `TABS` constant (currently hardcoded with bilingual labels):

```ts

const TABS = [
  ['overview', t.patientDetail.tabs.overview],
  ['problems', t.patientDetail.tabs.problems],
  ['documents', t.patientDetail.tabs.documents],
  ['treatment', t.patientDetail.tabs.treatment],
  ['progress', t.patientDetail.tabs.progress],
  ['fees', t.patientDetail.tabs.fees],
  ['assessment', t.patientDetail.tabs.assessment],
] as const;

```

Note: Moving `TABS` inside the async function so `t` is available. The `Tab` type must remain: `type Tab = 'overview' | 'problems' | 'documents' | 'treatment' | 'progress' | 'fees' | 'assessment'` (define it explicitly since the `as const` tabs are now dynamic).

Replace `isValidTab`:

```ts

const VALID_TABS = ['overview', 'problems', 'documents', 'treatment', 'progress', 'fees', 'assessment'] as const;
type Tab = typeof VALID_TABS[number];
function isValidTab(value: unknown): value is Tab {
  return typeof value === 'string' && VALID_TABS.includes(value as Tab);
}

```

For all the section strings inside each tab component (Overview, Problems, Documents, etc.) — these are sub-functions defined in the same file. Pass `t` to each sub-function as a parameter and replace all bilingual strings with `t.section.key`.

Key replacements by section:
- Overview: `t.patientDetail.personal`, `t.patientDetail.age`, `t.patientDetail.gender`, `t.patientDetail.occupation`, `t.patientDetail.bodyMetrics`, `t.patientDetail.weightKg`, `t.patientDetail.heightCm`, `t.patientDetail.contact`, `t.patientDetail.mobile`, `t.patientDetail.email`, `t.patientDetail.emergency`, `t.patientDetail.address`, `t.patientDetail.assessmentSnapshot`, `t.patientDetail.editSnapshot`, `t.patientDetail.fillSnapshot`, `t.patientDetail.noAssessment`, `t.patientDetail.stress`, `t.patientDetail.sleepQuality`, `t.patientDetail.activity`, `t.patientDetail.goal`, `t.patientDetail.contraindicationsNoted`
- Problems: `t.problems.title`, `t.problems.noProblems`, `t.problems.presetLabel`, `t.problems.noteLabel`, `t.problems.notePlaceholder`, `t.problems.addBtn`, `t.problems.otherProblem`, `t.problems.customPlaceholder`, `t.problems.addCustomBtn`
- Documents: `t.documents.title`, `t.documents.typeLabel`, `t.documents.fileLabel`, `t.documents.uploadBtn`, `t.documents.noDocs`
- Treatment: `t.treatment.title`, `t.treatment.addVisit`, `t.treatment.visitDate`, `t.treatment.visitWeight`, `t.treatment.visitPain`, `t.treatment.nextVisit`, `t.treatment.nextVisitOptional`, `t.treatment.progressNote`, `t.treatment.addVisitBtn`, `t.treatment.noVisits`
- Progress: `t.progress.title`, `t.progress.weightTrend`, `t.progress.painTrend`, `t.progress.notEnoughData`, `t.progress.firstVisit`, `t.progress.latest`, `t.progress.visitsWithData`, `t.progress.weightChange`, `t.progress.painChange`
- Fees: `t.fees.title`, `t.fees.courseFee`, `t.fees.totalPaid`, `t.fees.balanceDue`, `t.fees.setCourseFee`, `t.fees.totalCourseFee`, `t.fees.setBtn`, `t.fees.recordPayment`, `t.fees.amount`, `t.fees.paymentDate`, `t.fees.note`, `t.fees.notePlaceholder`, `t.fees.addBtn`, `t.fees.paymentHistory`, `t.fees.noPayments`
- Assessment form: all `t.assessment.*` keys

Note: Sub-functions defined inside the file (Overview, Problems, etc.) must accept `t: Translations` as a parameter and be called as `<Overview patient={patient} t={t} />`.

- [ ] **Step 5: Migrate `src/app/(app)/patients/[id]/edit/page.tsx`**

Add import + `const t = getTranslations(await getLocale())`:

```tsx

<PageHeader title={t.patientDetail.editTitle} subtitle={`${patient.fullName} · ${patient.patientCode}`} />
submitLabel={t.common.save}

```

- [ ] **Step 6: Migrate `src/app/(app)/patients/[id]/print/page.tsx` and `receipt/page.tsx`**

Both pages are server components. Add the same import pattern.

For print:

```tsx

<title>{t.print.patientReport}</title>
Generated on → {t.print.generatedOn}

```

For receipt:

```tsx

<title>{t.receipt.title}</title>
Payment Receipt heading → {t.receipt.title}

```

- [ ] **Step 7: Migrate `src/app/login/page.tsx`**

The login page is outside `(app)` layout but can still read the `lang` cookie via `getLocale()`:

```ts

import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';

```

Inside `LoginPage`:

```ts

const t = getTranslations(await getLocale());

```

Replacements:

```tsx

Pawar's Yog Therapy → {t.auth.loginTitle}
Admin Login / प्रवेश → {t.auth.loginSubtitle}
Wrong email or password / ... → {t.auth.wrongCredentials}
Account registered! Please sign in. / ... → {t.auth.accountRegistered}
Email / ईमेल → {t.auth.email}
Password / पासवर्ड → {t.auth.password}
Sign in / लॉगिन → {t.auth.loginBtn}
Don't have an account? → {t.auth.noAccount}
Register / नोंदणी करा → {t.auth.registerLink}

```

- [ ] **Step 8: Migrate `src/app/register/page.tsx`**

Same import pattern. Read the file first, then replace all bilingual strings with `t.auth.*` keys.

- [ ] **Step 9: Run typecheck and full test suite**

```bash

npm run typecheck && npm test

```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash

git add src/app/
git commit -m "refactor: migrate server component pages to i18n translation keys"

```

---

## Task 6: Client Component String Migration

**Files:**
- Modify: `src/components/PatientCard.tsx` (add `'use client'`)
- Modify: `src/components/PatientHeader.tsx`
- Modify: `src/components/PatientForm.tsx`
- Modify: `src/components/TreatmentPlanForm.tsx`
- Modify: `src/components/DeleteButton.tsx`
- Modify: `src/components/InlineForm.tsx`
- Modify: `src/components/BranchFilter.tsx`
- Modify: `src/components/GlobalSearch.tsx`
- Modify: `src/components/StopwatchWidget.tsx`
- Modify: `src/components/Sidebar.tsx`

**Pattern for all client components:**

```ts

import { useTranslations } from '@/lib/i18n/context';

// Inside the component function:
const t = useTranslations();
// Then use t.section.key everywhere

```

- [ ] **Step 1: Migrate `src/components/PatientCard.tsx`**

Add `'use client'` directive at the top (first line). Add import and hook:

```tsx

'use client';

import { useTranslations } from '@/lib/i18n/context';
// ... existing imports ...

```

Inside `PatientCard`:

```ts

const t = useTranslations();

```

Replace `assessmentChip` function to accept `t`:

```ts

function assessmentChip(filled: number, t: ReturnType<typeof useTranslations>): { text: string; cls: string } {
  if (filled === 5)
    return { text: t.assessment.chip.complete, cls: 'bg-primary/10 text-primary' };
  if (filled > 0)
    return {
      text: t.assessment.chip.partial.replace('{filled}', String(filled)),
      cls: 'bg-yellow-100 text-yellow-800',
    };
  return { text: t.assessment.chip.missing, cls: 'bg-muted text-muted-foreground' };
}

```

Call it as `assessmentChip(completionStatus.filled, t)`.

Replace overflow count:

```tsx

{overflow > 0 && (
  <span className="text-xs text-muted-foreground">
    {t.patients.moreProblems.replace('{count}', String(overflow))}
  </span>
)}

```

- [ ] **Step 2: Migrate `src/components/PatientHeader.tsx`**

Add import and hook. Replace:

```tsx

Edit / บดลา → {t.patientDetail.edit}
Report / อहवाล → {t.patientDetail.report}
Receipt / पावती → {t.patientDetail.receipt}

```

Full replacement in JSX:

```tsx

<Link href={`/patients/${patient.id}/edit`}>
  <Pencil className="mr-1.5 h-3.5 w-3.5" />
  {t.patientDetail.edit}
</Link>
// ...
<Link href={`/patients/${patient.id}/print`}>
  <Printer className="mr-1.5 h-3.5 w-3.5" />
  {t.patientDetail.report}
</Link>
// ...
<Link href={`/patients/${patient.id}/receipt`}>
  <Receipt className="mr-1.5 h-3.5 w-3.5" />
  {t.patientDetail.receipt}
</Link>

```

- [ ] **Step 3: Migrate `src/components/PatientForm.tsx`**

Add import and hook inside `PatientForm`.

Replace section labels and form labels:

```tsx

Personal Info / वैयक्तिक माहिती → {t.form.personalInfo}
Full Name / पूर्ण नाव * → {t.form.fullName} *
Photo / फोटो → {t.form.photoLabel}
Age / वय → {t.form.age}
Gender / लिंग → {t.form.gender}
Occupation / व्यवसाय → {t.form.occupation}
Select gender → {t.form.selectGender}
Male / पुरुष → {t.form.genderMale}
Female / महिला → {t.form.genderFemale}
Other / इतर → {t.form.genderOther}
Body Metrics / ... → {t.form.bodyMetrics}
Weight (kg) / ... → {t.form.weightKg}
Height (cm) / ... → {t.form.heightCm}
BMI / ... → {t.form.bmi}
Contact Info / ... → {t.form.contactInfo}
Mobile / ... → {t.form.mobile}
Email / ... → {t.form.email}
Address / ... → {t.form.address}
Emergency Contact / ... → {t.form.emergencyContact}
Branch / ... → {t.form.branch}
Select branch → {t.form.selectBranch}

```

The `submitLabel` prop already comes from the parent — no change needed for the button text.

- [ ] **Step 4: Migrate `src/components/TreatmentPlanForm.tsx`**

Add import and hook. Replace `PLAN_FIELDS` constant — it currently maps field keys to bilingual strings. Change to use translation keys:

```ts

const PLAN_FIELDS: [keyof TreatmentDraftFields, string][] = [
  ['yogaProgram', t.treatmentPlan.yoga],
  ['pranayam', t.treatmentPlan.pranayam],
  ['massage', t.treatmentPlan.massage],
  ['yogaTherapy', t.treatmentPlan.yogaTherapy],
  ['dietPlan', t.treatmentPlan.diet],
  ['medicines', t.treatmentPlan.medicines],
  ['panchkarma', t.treatmentPlan.panchkarma],
];

```

Note: `PLAN_FIELDS` must be defined inside the component function (after `const t = useTranslations()`), not at module scope. Move it inside `TreatmentPlanForm`.

Replace button strings:

```tsx

Save Plan / ... → {t.treatmentPlan.saveBtn}
Saving… → {t.treatmentPlan.saving}
Progress Notes / ... → {t.treatmentPlan.progressNotes}
Treatment Plan / ... → {t.treatmentPlan.title}  (card title if present)

```

- [ ] **Step 5: Migrate `src/components/DeleteButton.tsx`**

Add import and hook. The `label` prop has a default value of `'Delete / काढा'` — remove the default (callers should pass it explicitly, or use `t.deleteButton.deleteBtn` as the default via the hook):

```tsx

export function DeleteButton({
  action,
  confirmText,
  label,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  confirmText: string;
  label?: string;
}) {
  const t = useTranslations();
  const displayLabel = label ?? t.deleteButton.deleteBtn;

```

Replace dialog strings:

```tsx

<AlertDialogTitle>{t.deleteButton.confirmDelete}</AlertDialogTitle>
<AlertDialogCancel>{t.deleteButton.cancelBtn}</AlertDialogCancel>
{pending ? t.deleteButton.deleting : t.deleteButton.deleteBtn}

```

Replace trigger button:

```tsx

<Button ...>{displayLabel}</Button>

```

- [ ] **Step 6: Migrate `src/components/InlineForm.tsx`**

Add import and hook. Replace:

```tsx

Saving… / ... → {t.inlineForm.submitting}
Saved / ... → {t.inlineForm.saved}
Something went wrong... → {t.inlineForm.genericError}

```

Full replacement:

```tsx

{error && <p className="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
{pending && <p className="mb-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">{t.inlineForm.submitting}</p>}
{saved && !pending && <p className="mb-2 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{t.inlineForm.saved}</p>}

```

And in the error catch block:

```ts

setError(t.inlineForm.genericError);

```

Note: `useTranslations()` is called inside the component, but the `genericError` string is set in a closure (the `action` callback). Capture it before the closure:

```tsx

export function InlineForm({ action, children, className }) {
  const t = useTranslations();
  const genericError = t.inlineForm.genericError;
  // ...
  // Inside catch:
  setError(genericError);
}

```

- [ ] **Step 7: Migrate `src/components/BranchFilter.tsx`**

Add import and hook. Replace:

```tsx

placeholder="All branches / สр्व शाखा" → placeholder={t.branchFilter.allBranches}
All branches / สर्व शाखा → {t.branchFilter.allBranches}

```

- [ ] **Step 8: Migrate `src/components/GlobalSearch.tsx`**

Add import and hook. Replace:

```tsx

placeholder="Search for a patient / ..." → placeholder={t.globalSearch.placeholder}
No matches / ... → {t.globalSearch.noResults}

```

- [ ] **Step 9: Migrate `src/components/StopwatchWidget.tsx`**

Add import and hook. Read the full StopwatchWidget file (it was partially read). Replace all bilingual strings with `t.stopwatch.*` keys:

```tsx

Session Timer / ... → {t.stopwatch.title}
Start / ... → {t.stopwatch.start}
Pause / ... → {t.stopwatch.pause}
Reset / ... → {t.stopwatch.reset}
Pulse Checker / ... → {t.stopwatch.pulseChecker}
Tap to measure BPM / ... → {t.stopwatch.tapToMeasure}
BPM → {t.stopwatch.bpm}
Tapping… / ... → {t.stopwatch.tapping}
Tap again / ... → {t.stopwatch.tapAgain}

```

- [ ] **Step 10: Migrate `src/components/Sidebar.tsx`**

Add import and hook. Replace all navigation item `name` strings, section headings, and the bottom card:

```tsx

// Inside Sidebar function:
const t = useTranslations();

const menuItems: MenuItem[] = [
  { name: t.nav.dashboard, href: '/dashboard', icon: LayoutDashboard },
  { name: t.nav.patients, href: '/patients', icon: Users, badge: patientCount },
  { name: t.nav.calendar, href: '#', icon: Calendar, disabled: true },
  { name: t.nav.analytics, href: '#', icon: BarChart, disabled: true },
];

const generalItems = [
  { name: t.nav.settings, href: '/settings', icon: Settings },
  { name: t.nav.help, href: '#', icon: HelpCircle, disabled: true },
];

```

Replace section headings and bottom card:

```tsx

Menu → {t.nav.dashboard.slice(0, 0) /* section heading */}

```

Actually the section headings are hardcoded `"Menu"` and `"General"` — these aren't in the spec. Leave them as-is (they're internal UI chrome, not patient-facing strings). Only replace strings in the spec.

Replace bottom card:

```tsx

Need Help? → {t.nav.needHelp}
Contact support if you... → {t.nav.needHelpBody}
Contact Support → {t.nav.contactSupport}

```

Replace logout:

```tsx

Logout → {t.nav.logout}

```

Replace "Soon" badge:

```tsx

Soon → {t.common.soon}

```

Replace close button aria-label:

```tsx

aria-label="Close menu" → aria-label={t.nav.dashboard} // or keep as English for screen readers

```

Leave the `aria-label="Close menu"` and `aria-label="Open sidebar"` in TopNav as-is (accessible names don't need translation in this phase).

- [ ] **Step 11: Run typecheck and full test suite**

```bash

npm run typecheck && npm test

```

Expected: all pass.

- [ ] **Step 12: Commit**

```bash

git add src/components/
git commit -m "refactor: migrate client components to i18n translation keys"

```

---

## Manual QA Checklist

After all tasks complete, verify in the browser:

1. Start at `/settings` — language is English by default
2. Switch to मराठी — save — page reloads in Marathi
3. Navigate to `/dashboard` — all strings in Marathi
4. Navigate to `/patients` — title, search placeholder, badges in Marathi
5. Open a patient — all tabs, form labels, buttons in Marathi
6. Add a visit — InlineForm "Saving…" and "Saved ✓" appear in Marathi
7. Log out — log in on a different browser tab — language persists (DB preference)
8. Switch back to English in Settings — verify all English strings restore
9. `npm run build` — no build errors
