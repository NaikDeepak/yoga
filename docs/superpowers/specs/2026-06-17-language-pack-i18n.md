# Language Pack & i18n System

**Date:** 2026-06-17
**Status:** Approved
**Scope:** Replace all hardcoded "English / मराठी" bilingual strings with a typed language pack system. Add a per-user language preference stored in the DB and cached in a cookie. Enable the Settings page with a language switcher.

---

## 1. Goals

- Every fixed UI string in every page and component is looked up from a typed translation object.
- Language preference is per logged-in user, persists across devices (stored in DB).
- Adding a new language later requires only one new file and one union type entry.
- No external i18n library.

---

## 2. Supported Locales

```ts
export const LOCALES = ['en', 'mr'] as const;
export type Locale = typeof LOCALES[number]; // 'en' | 'mr'
```

To add Hindi later: add `'hi'` to `LOCALES` and create `src/lib/i18n/hi.ts`.

---

## 3. Translation Files

### 3.1 File Layout

```
src/lib/i18n/
  en.ts             — English strings (source of truth, defines Translations type)
  mr.ts             — Marathi strings (must satisfy Translations type)
  translations.ts   — getTranslations(), LOCALES, Locale type (no server imports — safe for client)
  server.ts         — getLocale() only (imports next/headers cookies — server-only)
  context.tsx       — LocaleProvider (client), useTranslations() hook
```

**Why the split:** `next/headers` is server-only. `context.tsx` is a client component and cannot import from a file that imports `next/headers`. By keeping `getTranslations()` in `translations.ts` (no server imports) and isolating `getLocale()` in `server.ts`, client and server code can each import safely.

### 3.2 `en.ts` — Full Key Catalogue

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
    loginTitle: 'Pawar\'s Yog Therapy',
    loginSubtitle: 'Sign in to your account',
    email: 'Email',
    password: 'Password',
    loginBtn: 'Sign In',
    registerTitle: 'Create Account',
    registerBtn: 'Create Account',
    loggingIn: 'Signing in…',
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
  },
  inlineForm: {
    submitting: 'Saving…',
    errorPrefix: 'Error:',
  },
} as const;

export type Translations = typeof en;
```

### 3.3 `mr.ts` — Marathi Strings

`mr.ts` must export an object satisfying `Translations`. Every key present in `en.ts` must be present in `mr.ts`. TypeScript enforces this at compile time:

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
  // ... (all keys, full Marathi translations)
};
```

---

## 4. Core Modules

### 4.1 `src/lib/i18n/translations.ts` (client-safe)

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

### 4.2 `src/lib/i18n/server.ts` (server-only — never import from client components)

```ts
import { cookies } from 'next/headers';
import { LOCALES, type Locale } from './translations';

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value;
  return (LOCALES as readonly string[]).includes(lang ?? '') ? (lang as Locale) : 'en';
}
```

**Server components** import from both: `getTranslations` from `./translations`, `getLocale` from `./server`.
**Client components** import only from `./translations` (via context).

---

## 5. Client Context — `src/lib/i18n/context.tsx`

```tsx
'use client';
import { createContext, useContext } from 'react';
import { en } from './en';
import type { Translations } from './en';
import type { Locale } from './translations';
import { getTranslations } from './translations';  // safe — no next/headers import

const LocaleContext = createContext<Translations>(en);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
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

**`AppShell`** receives `locale: Locale` from `layout.tsx` and renders `<LocaleProvider locale={locale}>` around children.

---

## 6. DB Layer

### 6.1 Schema addition — `src/db/schema.ts`

```ts
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id').primaryKey(),
  language: text('language').notNull().default('en'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

### 6.2 Data function — `src/data/preferences.ts`

```ts
export async function getUserLanguage(db: Db, userId: string): Promise<Locale> { ... }
export async function setUserLanguage(db: Db, userId: string, locale: Locale): Promise<void> { ... }
```

### 6.3 Server action — `src/actions/preferences.ts`

```ts
export async function saveLanguageAction(locale: Locale): Promise<void>
// Validates locale ∈ LOCALES
// Calls setUserLanguage(db, userId, locale)
// Sets 'lang' cookie (httpOnly, path='/', maxAge = 1 year)
// revalidatePath('/', 'layout')
```

### 6.4 Layout sync — `src/app/(app)/layout.tsx`

On every load, after reading the user from Supabase auth:
1. Read `lang` cookie. If present and valid → use it.
2. If absent → fetch `getUserLanguage(db, userId)` → set cookie → use it.
3. Pass `locale` to `AppShell`.

This ensures DB preference propagates to cookie on first load on a new device.

---

## 7. Settings Page

**Route:** `src/app/(app)/settings/page.tsx`

- `PageHeader` with `t.settings.title` / subtitle
- Card with language selector: radio group showing each locale in its own name (`English`, `मराठी`)
- Save button → `saveLanguageAction(selectedLocale)`
- Current selection pre-filled from `getLocale()`
- On save: success toast or inline confirmation message

**Sidebar:** Enable the Settings link (remove `disabled: true`, set `href: '/settings'`).

---

## 8. String Migration

All ~191 bilingual string instances across ~20 files are replaced:

**Server components** (pages): add `const t = getTranslations(await getLocale())` at the top of each page function, then replace strings with `t.key`.

**Client components**: replace strings with `const t = useTranslations()` then `t.key`.

**Files to migrate:**
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/patients/page.tsx`
- `src/app/(app)/patients/new/page.tsx`
- `src/app/(app)/patients/[id]/page.tsx`
- `src/app/(app)/patients/[id]/edit/page.tsx`
- `src/app/(app)/patients/[id]/print/page.tsx`
- `src/app/(app)/patients/[id]/receipt/page.tsx`
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/PatientForm.tsx`
- `src/components/PatientCard.tsx`
- `src/components/PatientHeader.tsx`
- `src/components/TreatmentPlanForm.tsx`
- `src/components/DeleteButton.tsx`
- `src/components/InlineForm.tsx`
- `src/components/BranchFilter.tsx`
- `src/components/GlobalSearch.tsx`
- `src/components/StopwatchWidget.tsx`
- `src/components/Sidebar.tsx`
- `src/components/TopNav.tsx`

---

## 9. What Is NOT Changing

- No routing changes (no `/en/patients` URL scheme)
- No external i18n library
- No changes to DB schema beyond `user_preferences` table
- Print/receipt pages: migrate strings but no layout changes
- Test files: no changes required (string content not tested)

---

## 10. Testing

- `src/data/preferences.ts`: TDD with PGlite — `getUserLanguage` returns default 'en' when no row; `setUserLanguage` upserts correctly
- `src/actions/preferences.ts`: test validates locale, rejects unknown locales
- TypeScript enforces `mr.ts` completeness at compile time — no missing-key tests needed
- Manual QA: switch language in Settings, navigate all pages, verify strings update
