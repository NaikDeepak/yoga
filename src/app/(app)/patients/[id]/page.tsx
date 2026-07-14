import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { getPatientFees, type PatientFees } from '@/data/fees';
import { setCourseFeeAction, addPaymentAction, deletePaymentAction } from '@/actions/fees';
import { listVisits, listVisitsWithData } from '@/data/visits';
import { VisitLineChart } from '@/components/VisitLineChart';
import { getStorage } from '@/lib/storage';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { getISTDateString, formatFullDate } from '@/lib/dates';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { addVisitAction } from '@/actions/visits';
import { TreatmentPlanForm } from '@/components/TreatmentPlanForm';
import { PrescribedExercisesForm } from '@/components/PrescribedExercisesForm';
import { listAllExercises, getPrescribedExercises } from '@/data/exercises';
import { getLifestyleAssessment, getLifestyleAssessmentSnapshot } from '@/data/lifestyle';
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineForm } from '@/components/InlineForm';
import { PatientHeader } from '@/components/PatientHeader';
import { TabDropdown } from '@/components/TabDropdown';
import { SubmitButton } from '@/components/SubmitButton';
import { PainScaleInput } from '@/components/PainScaleInput';
import { NativeSelect } from '@/components/ui/native-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { getLocale } from '@/lib/i18n/server';
import { getTranslations } from '@/lib/i18n/translations';
import type { Translations } from '@/lib/i18n/en';

const VALID_TABS = ['overview', 'treatment', 'documents', 'fees', 'assessment'] as const;
type Tab = typeof VALID_TABS[number];

// Old bookmarked/dashboard links may still use the pre-merge tab names.
const LEGACY_TAB_MAP: Record<string, Tab> = { problems: 'overview', progress: 'treatment' };

function painColor(scale: number) {
  if (scale <= 3) return 'bg-primary';
  if (scale <= 6) return 'bg-yellow-500';
  return 'bg-destructive';
}

function isValidTab(value: unknown): value is Tab {
  return typeof value === 'string' && VALID_TABS.includes(value as Tab);
}

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const t = getTranslations(await getLocale());
  const { id } = await params;
  const rawTab = (await searchParams).tab;
  const tab: Tab = isValidTab(rawTab) ? rawTab : LEGACY_TAB_MAP[rawTab ?? ''] ?? 'overview';
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const photoUrl = patient.photoPath ? await getStorage().createSignedUrl(patient.photoPath) : null;
  const patientFees = await getPatientFees(db, id);

  const TABS: [Tab, string][] = [
    ['overview', t.patientDetail.tabs.overview],
    ['treatment', t.patientDetail.tabs.treatment],
    ['documents', t.patientDetail.tabs.documents],
    ['fees', t.patientDetail.tabs.fees],
    ['assessment', t.patientDetail.tabs.assessment],
  ];

  return (
    <div className="space-y-6">
      <PatientHeader patient={patient} photoUrl={photoUrl} hasCourseFee={patientFees.courseFee !== null} />

      <TabDropdown patientId={id} activeTab={tab} tabs={TABS} />

      {/* Tab navigation — URL-based for server rendering, styled like shadcn Tabs. Hidden on mobile in favor of TabDropdown. */}
      <div className="hidden h-9 w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground sm:inline-flex">
        {TABS.map(([key, title]) => (
          <Link
            key={key}
            href={`/patients/${id}?tab=${key}`}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all ${
              tab === key
                ? 'bg-card text-foreground shadow-sm'
                : 'hover:bg-card/50 hover:text-foreground'
            }`}
          >
            {title}
          </Link>
        ))}
      </div>

      {/* Tab content — keyed by tab so it remounts and fades in on every switch */}
      <div key={tab} className="animate-in fade-in duration-200">
        {tab === 'overview' && <Overview patient={patient} t={t} />}
        {tab === 'documents' && <Documents patientId={id} t={t} />}
        {tab === 'treatment' && (
          <div className="space-y-8">
            <Treatment patientId={id} t={t} />
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{t.progress.title}</h2>
              <Progress patientId={id} t={t} />
            </div>
          </div>
        )}
        {tab === 'fees' && <Fees patientId={id} patientFees={patientFees} t={t} />}
        {tab === 'assessment' && <Assessment patientId={id} t={t} />}
      </div>
    </div>
  );
}

async function Overview({
  patient,
  t,
}: {
  patient: NonNullable<Awaited<ReturnType<typeof getPatient>>>;
  t: Translations;
}) {
  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const db = getDb();
  const [assessment, visits] = await Promise.all([
    getLifestyleAssessmentSnapshot(db, patient.id),
    listVisits(db, patient.id),
  ]);
  const today = getISTDateString(0);
  const lastVisit = visits[0]?.visitDate ?? null; // listVisits is ordered newest-first
  const nextVisit = visits
    .map((v) => v.nextVisitDate)
    .filter((d): d is string => d !== null && d >= today)
    .sort()[0] ?? null;

  function bmiClass() {
    if (bmi === null) return 'bg-muted text-muted-foreground';
    if (bmi < 18.5) return 'bg-blue-100 text-blue-800';
    if (bmi < 25) return 'bg-primary/10 text-primary';
    if (bmi < 30) return 'bg-yellow-100 text-yellow-800';
    return 'bg-destructive/10 text-destructive';
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t.patientDetail.personal}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            [t.patientDetail.birthDate, patient.birthDate ? String(patient.birthDate).substring(0, 10) : null],
            [t.patientDetail.age, patient.age],
            [t.patientDetail.gender, patient.gender],
            [t.patientDetail.occupation, patient.occupation],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right">{v ?? '—'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t.patientDetail.bodyMetrics}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            [t.patientDetail.weightKg, patient.weightKg ? `${patient.weightKg} kg` : null],
            [t.patientDetail.heightCm, patient.heightCm ? `${patient.heightCm} cm` : null],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span>{v ?? '—'}</span>
            </div>
          ))}
          <div className="pt-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${bmiClass()}`}
            >
              BMI: {bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : '—'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Visits summary: the numbers the doctor checks first, without leaving Overview */}
      <Card className="rounded-2xl sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t.patientDetail.visitsTitle}</CardTitle>
          <Link href={`/patients/${patient.id}?tab=treatment#add-visit`} className="text-xs text-primary hover:underline">
            {t.patientDetail.logVisit}
          </Link>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t.patientDetail.lastVisit}</p>
            <p className="font-medium">{lastVisit ? formatFullDate(lastVisit) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.patientDetail.nextVisit}</p>
            <p className="font-medium">{nextVisit ? formatFullDate(nextVisit) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.patientDetail.totalVisits}</p>
            <p className="font-medium">{visits.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t.patientDetail.contact}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            [t.patientDetail.mobile, patient.mobile],
            [t.patientDetail.email, patient.email],
            [t.patientDetail.emergency, patient.emergencyContact],
            [t.patientDetail.address, patient.address],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 border-b border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right">{v ?? '—'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl sm:col-span-2">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t.patientDetail.assessmentSnapshot}</CardTitle>
          <Link href={`/patients/${patient.id}?tab=assessment`} className="text-xs text-primary hover:underline">
            {assessment ? t.patientDetail.editSnapshot : t.patientDetail.fillSnapshot}
          </Link>
        </CardHeader>
        <CardContent className="text-sm">
          {!assessment ? (
            <p className="text-muted-foreground">{t.patientDetail.noAssessment}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(() => {
                const activityLabels: Record<string, string> = {
                  sedentary: t.assessment.sedentary,
                  light: t.assessment.light,
                  active: t.assessment.active,
                };
                const stressColor = assessment.stressLevel == null ? '' : assessment.stressLevel >= 8 ? 'text-destructive font-medium' : assessment.stressLevel >= 5 ? 'text-yellow-700 font-medium' : 'text-primary font-medium';
                const sleepColor = assessment.sleepQuality == null ? '' : assessment.sleepQuality <= 3 ? 'text-destructive font-medium' : assessment.sleepQuality <= 6 ? 'text-yellow-700 font-medium' : 'text-primary font-medium';
                return [
                  { label: t.patientDetail.stress, value: assessment.stressLevel != null ? `${assessment.stressLevel}/10` : null, cls: stressColor },
                  { label: t.patientDetail.sleepQuality, value: assessment.sleepQuality != null ? `${assessment.sleepQuality}/10` : null, cls: sleepColor },
                  { label: t.patientDetail.activity, value: assessment.activityLevel ? (activityLabels[assessment.activityLevel] ?? assessment.activityLevel) : null, cls: '' },
                  { label: t.patientDetail.goal, value: assessment.primaryGoal, cls: '' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-border pb-1.5">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className={`text-right line-clamp-2 ${cls || 'text-foreground'}`}>{value ?? '—'}</span>
                  </div>
                ));
              })()}
              {(() => {
                const details = assessment.contraindicationDetails?.trim();
                const showWarning = assessment.hasContraindications || !!details;
                if (!showWarning) return null;
                return (
                  <div className="sm:col-span-2 mt-1 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs font-medium">
                    <span className="shrink-0">⚠</span>
                    <span>
                      {t.patientDetail.contraindicationsNoted}
                      {details && ` — ${details}`}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Problems — merged into Overview so the clinical picture is one screen */}
      <div className="sm:col-span-2 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground px-1">{t.patientDetail.tabs.problems}</h2>
        <Problems patientId={patient.id} t={t} />
      </div>
    </div>
  );
}

async function Problems({ patientId, t }: { patientId: string; t: Translations }) {
  const problems = await listProblems(getDb(), patientId);
  const add = addProblemAction.bind(null, patientId);
  return (
    <div className="max-w-xl space-y-4">
      <ul className="space-y-2">
        {problems.length === 0 && (
          <li className="text-sm text-muted-foreground">{t.problems.noProblems}</li>
        )}
        {problems.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
          >
            <span className="text-sm">
              {p.problem}
              {p.note && <span className="ml-2 text-muted-foreground">({p.note})</span>}
            </span>
            <DeleteButton
              action={removeProblemAction.bind(null, patientId, p.id)}
              confirmText={t.problems.removeConfirmation.replace('{problem}', p.problem)}
              label={t.common.remove}
            />
          </li>
        ))}
      </ul>

      <Card className="rounded-2xl">
        <CardContent className="pt-4">
          <InlineForm action={add} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="problem-preset">{t.problems.presetLabel}</Label>
              <NativeSelect id="problem-preset" name="problem">
                {PRESET_PROBLEMS.map((prob) => (
                  <option key={prob} value={prob}>
                    {prob}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="problem-note">{t.problems.noteLabel}</Label>
              <Input id="problem-note" name="note" placeholder={t.problems.notePlaceholder} />
            </div>
            <SubmitButton size="sm" pendingLabel={`${t.problems.addBtn}...`}>{t.problems.addBtn}</SubmitButton>
          </InlineForm>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="pt-4">
          <InlineForm action={add} className="space-y-3">
            <input type="hidden" name="isCustom" value="true" />
            <div className="space-y-1.5">
              <Label htmlFor="custom-problem">{t.problems.otherProblem}</Label>
              <Input
                id="custom-problem"
                name="problem"
                placeholder={t.problems.customPlaceholder}
              />
            </div>
            <SubmitButton size="sm" pendingLabel={`${t.problems.addCustomBtn}...`}>{t.problems.addCustomBtn}</SubmitButton>
          </InlineForm>
        </CardContent>
      </Card>
    </div>
  );
}

async function Documents({ patientId, t }: { patientId: string; t: Translations }) {
  const docs = await listDocuments(getDb(), patientId);
  const storage = getStorage();
  const withUrls = await Promise.all(
    docs.map(async (d) => ({ ...d, url: await storage.createSignedUrl(d.filePath) })),
  );
  return (
    <div className="max-w-2xl space-y-4">
      <Card className="rounded-2xl">
        <CardContent className="pt-4">
          <InlineForm
            action={uploadDocumentAction.bind(null, patientId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">{t.documents.typeLabel}</Label>
              <NativeSelect id="doc-type" name="docType" className="w-auto">
                {DOC_TYPES.map((docType) => (
                  <option key={docType}>{docType}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">{t.documents.fileLabel}</Label>
              <Input
                id="doc-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
              />
            </div>
            <SubmitButton size="sm" pendingLabel={`${t.documents.uploadBtn}...`}>{t.documents.uploadBtn}</SubmitButton>
          </InlineForm>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <ul className="divide-y divide-border">
          {docs.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">{t.documents.noDocs}</li>
          )}
          {withUrls.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Badge variant="secondary" className="shrink-0">{d.docType}</Badge>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-medium text-primary hover:underline"
                >
                  {d.originalName}
                </a>
                <span className="shrink-0 text-muted-foreground">
                  {getISTDateString(0, d.createdAt)}
                </span>
              </div>
              <DeleteButton
                action={deleteDocumentAction.bind(null, patientId, d.id)}
                confirmText={t.documents.deleteConfirmation.replace('{name}', d.originalName)}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

async function Treatment({ patientId, t }: { patientId: string; t: Translations }) {
  const db = getDb();
  const plan = await getTreatmentPlan(db, patientId);
  const visits = await listVisits(db, patientId);
  const today = getISTDateString();
  const locale = await getLocale();

  const allExercises = await listAllExercises(db);
  const prescribedExercises = await getPrescribedExercises(db, patientId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <TreatmentPlanForm patientId={patientId} initialPlan={plan} />
        <PrescribedExercisesForm
          patientId={patientId}
          allExercises={allExercises}
          initialPrescribed={prescribedExercises}
          locale={locale}
        />
      </div>

      <div className="space-y-4">
        {/* scroll-mt clears the sticky TopNav when the header's "+ Add Visit" anchor lands here */}
        <Card id="add-visit" className="rounded-2xl scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-base">{t.treatment.addVisit}</CardTitle>
          </CardHeader>
          <CardContent>
            <InlineForm
              action={addVisitAction.bind(null, patientId)}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="visitDate">{t.treatment.visitDate}</Label>
                  <Input id="visitDate" name="visitDate" type="date" defaultValue={today} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="visitWeight">{t.treatment.visitWeight}</Label>
                  <Input id="visitWeight" name="weightKg" type="number" step="0.1" placeholder="—" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t.treatment.visitPain}</Label>
                <PainScaleInput name="painScale" ariaLabel={t.treatment.visitPain} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nextVisitDate">
                  {t.treatment.nextVisit}{' '}
                  <span className="text-xs text-muted-foreground">({t.treatment.nextVisitOptional})</span>
                </Label>
                <Input id="nextVisitDate" name="nextVisitDate" type="date" min={today} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="progressNote">{t.treatment.progressNote}</Label>
                <Textarea id="progressNote" name="progressNote" rows={2} />
              </div>
              <SubmitButton size="sm" pendingLabel={`${t.treatment.addVisitBtn}...`}>{t.treatment.addVisitBtn}</SubmitButton>
            </InlineForm>
          </CardContent>
        </Card>

        <ul className="space-y-2">
          {visits.length === 0 && (
            <li className="text-sm text-muted-foreground">{t.treatment.noVisits}</li>
          )}
          {visits.map((v) => (
            <li key={v.id}>
              <Card className="rounded-2xl">
                <CardContent className="pb-3 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{formatFullDate(v.visitDate)}</span>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {v.weightKg != null && <span>{v.weightKg} kg</span>}
                      {v.painScale != null && (
                        <span className="flex items-center gap-1">
                          <span
                            className={`inline-block h-2.5 w-2.5 rounded-full ${painColor(v.painScale)}`}
                          />
                          {v.painScale}/10
                        </span>
                      )}
                    </div>
                  </div>
                  {v.progressNote && (
                    <p className="mt-1 text-sm text-muted-foreground">{v.progressNote}</p>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

async function Progress({ patientId, t }: { patientId: string; t: Translations }) {
  const db = getDb();
  const rows = await listVisitsWithData(db, patientId);

  const weightData = rows
    .filter((r): r is typeof r & { weightKg: number } => r.weightKg !== null)
    .map((r) => ({ visitDate: r.visitDate, value: r.weightKg }));

  const painData = rows
    .filter((r): r is typeof r & { painScale: number } => r.painScale !== null)
    .map((r) => ({ visitDate: r.visitDate, value: r.painScale }));

  const firstDate = rows[0]?.visitDate ?? null;
  const latestDate = rows[rows.length - 1]?.visitDate ?? null;

  const weightChange =
    weightData.length >= 2
      ? weightData[weightData.length - 1].value - weightData[0].value
      : null;

  const painChange =
    painData.length >= 2
      ? painData[painData.length - 1].value - painData[0].value
      : null;

  if (rows.length === 0) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            {t.progress.notEnoughData}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t.progress.weightTrend}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightData.length >= 2 ? (
            <VisitLineChart data={weightData} color="var(--primary)" unit="kg" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.progress.notEnoughData}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t.progress.painTrend}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {painData.length >= 2 ? (
            <VisitLineChart data={painData} color="var(--destructive)" unit="" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.progress.notEnoughData}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">{t.progress.firstVisit}</p>
            <p className="font-medium">{firstDate ? formatFullDate(firstDate) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.progress.latest}</p>
            <p className="font-medium">{latestDate ? formatFullDate(latestDate) : '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t.progress.visitsWithData}</p>
            <p className="font-medium">{rows.length}</p>
          </div>
          {weightChange !== null && (
            <div>
              <p className="text-muted-foreground">{t.progress.weightChange}</p>
              <p className="font-medium text-foreground">
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
              </p>
            </div>
          )}
          {painChange !== null && (
            <div>
              <p className="text-muted-foreground">{t.progress.painChange}</p>
              <p className={`font-medium ${painChange <= 0 ? 'text-primary' : 'text-destructive'}`}>
                {painChange < 0 ? '↓' : '↑'} {Math.abs(painChange)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function Assessment({ patientId, t }: { patientId: string; t: Translations }) {
  const existing = await getLifestyleAssessment(getDb(), patientId);

  return (
    <div className="max-w-2xl space-y-6">
      <InlineForm
        action={saveLifestyleAssessmentAction.bind(null, patientId)}
        className="space-y-6"
      >
        {/* Section 1: Primary Concern */}
        <Card className="rounded-2xl border-l-4 border-l-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.assessment.primaryConcern}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-chiefComplaint">{t.assessment.chiefComplaint}</Label>
              <Textarea
                id="a-chiefComplaint"
                name="chiefComplaint"
                rows={3}
                defaultValue={existing?.chiefComplaint ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-duration">{t.assessment.duration}</Label>
              <Input
                id="a-duration"
                name="duration"
                placeholder={t.assessment.durationPlaceholder}
                defaultValue={existing?.duration ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-aggravatingFactors">{t.assessment.aggravatingFactors}</Label>
              <Textarea
                id="a-aggravatingFactors"
                name="aggravatingFactors"
                rows={2}
                defaultValue={existing?.aggravatingFactors ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-relievingFactors">{t.assessment.relievingFactors}</Label>
              <Textarea
                id="a-relievingFactors"
                name="relievingFactors"
                rows={2}
                defaultValue={existing?.relievingFactors ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-previousTreatment">{t.assessment.previousTreatment}</Label>
              <Textarea
                id="a-previousTreatment"
                name="previousTreatment"
                rows={2}
                defaultValue={existing?.previousTreatment ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Medications & Restrictions */}
        <Card className="rounded-2xl border-l-4 border-l-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.assessment.medicationsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-currentMedications">{t.assessment.currentMedications}</Label>
              <Textarea
                id="a-currentMedications"
                name="currentMedications"
                rows={2}
                defaultValue={existing?.currentMedications ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-doctorDiagnosis">{t.assessment.doctorDiagnosis}</Label>
              <Textarea
                id="a-doctorDiagnosis"
                name="doctorDiagnosis"
                rows={2}
                defaultValue={existing?.doctorDiagnosis ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-doctorRestrictions">
                {t.assessment.doctorRestrictions}
              </Label>
              <Textarea
                id="a-doctorRestrictions"
                name="doctorRestrictions"
                rows={2}
                defaultValue={existing?.doctorRestrictions ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Lifestyle */}
        <Card className="rounded-2xl border-l-4 border-l-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.assessment.lifestyleTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="a-workType">{t.assessment.workType}</Label>
                <NativeSelect
                  id="a-workType"
                  name="workType"
                  defaultValue={existing?.workType ?? ''}
                >
                  <option value="">—</option>
                  <option value="desk">{t.assessment.workDesk}</option>
                  <option value="standing">{t.assessment.workStanding}</option>
                  <option value="physical">{t.assessment.workPhysical}</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-dailySitting">{t.assessment.dailySitting}</Label>
                <NativeSelect
                  id="a-dailySitting"
                  name="dailySitting"
                  defaultValue={existing?.dailySitting ?? ''}
                >
                  <option value="">—</option>
                  <option value="<2h">{t.assessment.sittingOptions.under2}</option>
                  <option value="2-4h">{t.assessment.sittingOptions.twoToFour}</option>
                  <option value="4-8h">{t.assessment.sittingOptions.fourToEight}</option>
                  <option value="8+h">{t.assessment.sittingOptions.overEight}</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-activityLevel">{t.assessment.activityLevel}</Label>
                <NativeSelect
                  id="a-activityLevel"
                  name="activityLevel"
                  defaultValue={existing?.activityLevel ?? ''}
                >
                  <option value="">—</option>
                  <option value="sedentary">{t.assessment.sedentary}</option>
                  <option value="light">{t.assessment.light}</option>
                  <option value="active">{t.assessment.active}</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-sleepHours">{t.assessment.sleepHours}</Label>
                <Input
                  id="a-sleepHours"
                  name="sleepHours"
                  placeholder="e.g. 7"
                  defaultValue={existing?.sleepHours ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-sleepQuality">{t.assessment.sleepQuality} <span className="text-xs text-muted-foreground">({t.assessment.sleepQualityHint})</span></Label>
                <Input
                  id="a-sleepQuality"
                  name="sleepQuality"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="1–10"
                  defaultValue={existing?.sleepQuality?.toString() ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-stressLevel">{t.assessment.stressLevel} <span className="text-xs text-muted-foreground">({t.assessment.stressLevelHint})</span></Label>
                <Input
                  id="a-stressLevel"
                  name="stressLevel"
                  type="number"
                  min="1"
                  max="10"
                  placeholder="1–10"
                  defaultValue={existing?.stressLevel?.toString() ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-screenTime">{t.assessment.screenTime}</Label>
                <Input
                  id="a-screenTime"
                  name="screenTime"
                  placeholder="e.g. 6 hrs"
                  defaultValue={existing?.screenTime ?? ''}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Exercise History */}
        <Card className="rounded-2xl border-l-4 border-l-primary/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.assessment.exerciseTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-previousExercise">{t.assessment.previousExercise}</Label>
              <Input
                id="a-previousExercise"
                name="previousExercise"
                placeholder={t.assessment.previousExercisePlaceholder}
                defaultValue={existing?.previousExercise ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-fitnessLevel">{t.assessment.fitnessLevel}</Label>
              <NativeSelect
                id="a-fitnessLevel"
                name="fitnessLevel"
                defaultValue={existing?.fitnessLevel ?? ''}
              >
                <option value="">—</option>
                <option value="beginner">{t.assessment.fitnessBeginner}</option>
                <option value="intermediate">{t.assessment.fitnessIntermediate}</option>
                <option value="active">{t.assessment.fitnessActive}</option>
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer rounded-md border border-border px-3 py-2.5 hover:bg-muted/50">
              <input
                type="checkbox"
                name="fearOfMovement"
                value="true"
                defaultChecked={existing?.fearOfMovement ?? false}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t.assessment.fearOfMovement}
            </label>
          </CardContent>
        </Card>

        {/* Section 5: Goals & Safety */}
        <Card className="rounded-2xl border-l-4 border-l-destructive/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.assessment.goalsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-primaryGoal">{t.assessment.primaryGoal}</Label>
              <Textarea
                id="a-primaryGoal"
                name="primaryGoal"
                rows={2}
                defaultValue={existing?.primaryGoal ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-activityStruggle">{t.assessment.activityStruggle}</Label>
              <Input
                id="a-activityStruggle"
                name="activityStruggle"
                placeholder={t.assessment.activityStrugglePlaceholder}
                defaultValue={existing?.activityStruggle ?? ''}
              />
            </div>
            <label className="flex items-center gap-2.5 text-sm cursor-pointer rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 hover:bg-destructive/10">
              <input
                type="checkbox"
                name="hasContraindications"
                value="true"
                defaultChecked={existing?.hasContraindications ?? false}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              {t.assessment.hasContraindications}
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="a-contraindicationDetails">{t.assessment.contraindicationDetails}</Label>
              <Textarea
                id="a-contraindicationDetails"
                name="contraindicationDetails"
                rows={2}
                defaultValue={existing?.contraindicationDetails ?? ''}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <SubmitButton pendingLabel={`${t.assessment.saveBtn}...`}>{t.assessment.saveBtn}</SubmitButton>
        </div>
      </InlineForm>
    </div>
  );
}

function Fees({ patientId, patientFees, t }: { patientId: string; patientFees: PatientFees; t: Translations }) {
  const boundSetFee = setCourseFeeAction.bind(null, patientId, { ok: false, error: '' });
  const boundAddPayment = addPaymentAction.bind(null, patientId, { ok: false, error: '' });

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">
              {patientFees.courseFee !== null ? `₹${patientFees.courseFee.toLocaleString('en-IN')}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.fees.courseFee}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">₹{patientFees.totalPaid.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.fees.totalPaid}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="pt-4 text-center">
            <p className={`text-2xl font-bold ${(patientFees.balance ?? 0) > 0 ? 'text-destructive' : 'text-primary'}`}>
              {patientFees.balance !== null ? `₹${patientFees.balance.toLocaleString('en-IN')}` : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.fees.balanceDue}</p>
          </CardContent>
        </Card>
      </div>

      {/* Set course fee */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t.fees.setCourseFee}</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineForm action={boundSetFee}>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label htmlFor="courseFee">{t.fees.totalCourseFee}</Label>
                <Input
                  id="courseFee"
                  name="courseFee"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={patientFees.courseFee ?? ''}
                  placeholder="e.g. 2000"
                />
              </div>
              <SubmitButton size="sm" pendingLabel={`${t.fees.setBtn}...`}>{t.fees.setBtn}</SubmitButton>
            </div>
          </InlineForm>
        </CardContent>
      </Card>

      {/* Add payment */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t.fees.recordPayment}</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineForm action={boundAddPayment}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="amount">{t.fees.amount}</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="—" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paymentDate">{t.fees.paymentDate}</Label>
                <Input id="paymentDate" name="paymentDate" type="date" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">{t.fees.note}</Label>
                <Input id="description" name="description" placeholder={t.fees.notePlaceholder} />
              </div>
            </div>
            <SubmitButton size="sm" className="mt-3" pendingLabel={`${t.fees.addBtn}...`}>{t.fees.addBtn}</SubmitButton>
          </InlineForm>
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">{t.fees.paymentHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          {patientFees.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.fees.noPayments}</p>
          ) : (
            <ul className="space-y-2">
              {patientFees.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between border-b border-border pb-2 text-sm last:border-0">
                  <div>
                    <span className="font-medium">₹{p.amount.toLocaleString('en-IN')}</span>
                    <span className="ml-3 text-muted-foreground">{formatFullDate(p.paymentDate)}</span>
                    {p.description && <span className="ml-2 text-muted-foreground">— {p.description}</span>}
                  </div>
                  <DeleteButton
                    action={deletePaymentAction.bind(null, patientId, p.id)}
                    confirmText={t.fees.deletePaymentConfirmation.replace('{amount}', String(p.amount))}
                    label="×"
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
