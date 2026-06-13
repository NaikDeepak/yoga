import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pencil, Printer } from 'lucide-react';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { listDocuments } from '@/data/documents';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits, listVisitsWithData } from '@/data/visits';
import { VisitLineChart } from '@/components/VisitLineChart';
import { getStorage } from '@/lib/storage';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { PRESET_PROBLEMS, DOC_TYPES } from '@/lib/presets';
import { addProblemAction, removeProblemAction } from '@/actions/problems';
import { uploadDocumentAction, deleteDocumentAction } from '@/actions/documents';
import { saveTreatmentPlanAction } from '@/actions/treatment';
import { addVisitAction } from '@/actions/visits';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { saveLifestyleAssessmentAction } from '@/actions/lifestyle';
import { DeleteButton } from '@/components/DeleteButton';
import { InlineForm } from '@/components/InlineForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const TABS = [
  ['overview', 'Overview / माहिती'],
  ['problems', 'Problems / आजार'],
  ['documents', 'Documents / रिपोर्ट्स'],
  ['treatment', 'Treatment & Visits / उपचार'],
  ['progress', 'Progress / प्रगती'],
  ['assessment', 'Assessment / मूल्यांकन'],
] as const;
type Tab = (typeof TABS)[number][0];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function painColor(scale: number) {
  if (scale <= 3) return 'bg-primary';
  if (scale <= 6) return 'bg-yellow-500';
  return 'bg-destructive';
}

function isValidTab(value: unknown): value is Tab {
  return typeof value === 'string' && TABS.some(([key]) => key === value);
}

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const rawTab = (await searchParams).tab;
  const tab: Tab = isValidTab(rawTab) ? rawTab : 'overview';
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();

  const photoUrl = patient.photoPath ? await getStorage().createSignedUrl(patient.photoPath) : null;

  return (
    <div className="space-y-6">
      {/* Patient header */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {photoUrl && <AvatarImage src={photoUrl} alt={patient.fullName} />}
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {initials(patient.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{patient.fullName}</h1>
            <Badge variant="outline" className="border-brand-accent text-brand-accent">
              {patient.patientCode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{patient.mobile}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${id}/edit`}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit / बदला
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/patients/${id}/print`}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              PDF / प्रिंट
            </Link>
          </Button>
        </div>
      </div>

      {/* Tab navigation — URL-based for server rendering, styled like shadcn Tabs */}
      <div className="inline-flex h-9 w-full items-center justify-start overflow-x-auto rounded-lg bg-muted p-1 text-muted-foreground">
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

      {/* Tab content */}
      {tab === 'overview' && <Overview patient={patient} />}
      {tab === 'problems' && <Problems patientId={id} />}
      {tab === 'documents' && <Documents patientId={id} />}
      {tab === 'treatment' && <Treatment patientId={id} />}
      {tab === 'progress' && <Progress patientId={id} />}
      {tab === 'assessment' && <Assessment patientId={id} />}
    </div>
  );
}

async function Overview({
  patient,
}: {
  patient: NonNullable<Awaited<ReturnType<typeof getPatient>>>;
}) {
  const [bmi, assessment] = [computeBmi(patient.weightKg, patient.heightCm), await getLifestyleAssessment(getDb(), patient.id)];

  function bmiClass() {
    if (bmi === null) return 'bg-muted text-muted-foreground';
    if (bmi < 18.5) return 'bg-blue-100 text-blue-800';
    if (bmi < 25) return 'bg-primary/10 text-primary';
    if (bmi < 30) return 'bg-yellow-100 text-yellow-800';
    return 'bg-destructive/10 text-destructive';
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Personal / वैयक्तिक</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ['Age / वय', patient.age],
            ['Gender / लिंग', patient.gender],
            ['Occupation / व्यवसाय', patient.occupation],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right">{v ?? '—'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Body Metrics / शरीर</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ['Weight / वजन', patient.weightKg ? `${patient.weightKg} kg` : null],
            ['Height / उंची', patient.heightCm ? `${patient.heightCm} cm` : null],
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

      <Card className="sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Contact / संपर्क</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ['Mobile / मोबाईल', patient.mobile],
            ['Email / ईमेल', patient.email],
            ['Emergency / आपत्कालीन', patient.emergencyContact],
            ['Address / पत्ता', patient.address],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 border-b border-border pb-1.5">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right">{v ?? '—'}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="sm:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Assessment Snapshot / मूल्यांकन सारांश</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {!assessment ? (
            <p className="text-muted-foreground">
              No assessment yet / मूल्यांकन नाही —{' '}
              <Link href={`/patients/${patient.id}?tab=assessment`} className="text-primary underline underline-offset-2">
                go to Assessment tab
              </Link>
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['Stress / ताण', assessment.stressLevel != null ? `${assessment.stressLevel}/10` : null],
                ['Sleep Quality / झोप', assessment.sleepQuality != null ? `${assessment.sleepQuality}/10` : null],
                ['Activity / सक्रियता', assessment.activityLevel],
                ['Goal / उद्दिष्ट', assessment.primaryGoal],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-4 border-b border-border pb-1.5">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-right">{v ?? '—'}</span>
                </div>
              ))}
              {assessment.hasContraindications && (
                <div className="sm:col-span-2 mt-1 rounded-md bg-destructive/10 px-3 py-2 text-destructive text-xs font-medium">
                  ⚠ Contraindications noted / धोके नोंदवले
                  {assessment.contraindicationDetails && ` — ${assessment.contraindicationDetails}`}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

async function Problems({ patientId }: { patientId: string }) {
  const problems = await listProblems(getDb(), patientId);
  const add = addProblemAction.bind(null, patientId);
  return (
    <div className="max-w-xl space-y-4">
      <ul className="space-y-2">
        {problems.length === 0 && (
          <li className="text-sm text-muted-foreground">No problems recorded / नोंद नाही</li>
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
              confirmText={`Remove ${p.problem}?`}
              label="Remove / काढा"
            />
          </li>
        ))}
      </ul>

      <Card>
        <CardContent className="pt-4">
          <InlineForm action={add} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="problem-preset">Preset / आजार निवडा</Label>
              <select
                id="problem-preset"
                name="problem"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PRESET_PROBLEMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="problem-note">Note / टीप</Label>
              <Input id="problem-note" name="note" placeholder="Optional note" />
            </div>
            <Button type="submit" size="sm">Add / जोडा</Button>
          </InlineForm>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <InlineForm action={add} className="space-y-3">
            <input type="hidden" name="isCustom" value="true" />
            <div className="space-y-1.5">
              <Label htmlFor="custom-problem">Other problem / इतर आजार</Label>
              <Input
                id="custom-problem"
                name="problem"
                placeholder="Type custom problem / आजार लिहा"
              />
            </div>
            <Button type="submit" size="sm">Add custom / इतर जोडा</Button>
          </InlineForm>
        </CardContent>
      </Card>
    </div>
  );
}

async function Documents({ patientId }: { patientId: string }) {
  const docs = await listDocuments(getDb(), patientId);
  const storage = getStorage();
  const withUrls = await Promise.all(
    docs.map(async (d) => ({ ...d, url: await storage.createSignedUrl(d.filePath) })),
  );
  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardContent className="pt-4">
          <InlineForm
            action={uploadDocumentAction.bind(null, patientId)}
            className="flex flex-wrap items-end gap-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="doc-type">Type / प्रकार</Label>
              <select
                id="doc-type"
                name="docType"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-file">File (PDF/JPG/PNG, max 10MB)</Label>
              <Input
                id="doc-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
              />
            </div>
            <Button type="submit" size="sm">Upload / अपलोड</Button>
          </InlineForm>
        </CardContent>
      </Card>

      <Card>
        <ul className="divide-y divide-border">
          {docs.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">No documents / कागदपत्रे नाहीत</li>
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
                  {new Date(d.createdAt).toLocaleDateString('en-IN')}
                </span>
              </div>
              <DeleteButton
                action={deleteDocumentAction.bind(null, patientId, d.id)}
                confirmText={`Delete ${d.originalName}?`}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

async function Treatment({ patientId }: { patientId: string }) {
  const db = getDb();
  const plan = await getTreatmentPlan(db, patientId);
  const visits = await listVisits(db, patientId);
  const planFields: [keyof NonNullable<typeof plan> & string, string][] = [
    ['yogaProgram', 'Yoga Program / योग कार्यक्रम'],
    ['pranayam', 'Pranayam / प्राणायाम'],
    ['massage', 'Massage / मसाज'],
    ['yogaTherapy', 'Yoga Therapy / योग थेरपी'],
    ['dietPlan', 'Diet Plan / आहार योजना'],
    ['medicines', 'Medicines / औषधे'],
    ['panchkarma', 'Panchkarma / पंचकर्म'],
  ];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Treatment Plan / उपचार योजना</CardTitle>
        </CardHeader>
        <CardContent>
          <InlineForm
            action={saveTreatmentPlanAction.bind(null, patientId)}
            className="space-y-3"
          >
            {planFields.map(([name, title]) => (
              <div key={name} className="space-y-1.5">
                <Label htmlFor={`plan-${name}`}>{title}</Label>
                <Textarea
                  id={`plan-${name}`}
                  name={name}
                  rows={2}
                  defaultValue={(plan?.[name] as string | null) ?? ''}
                />
              </div>
            ))}
            <Button type="submit" size="sm">Save plan / योजना जतन करा</Button>
          </InlineForm>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Visit / नवीन भेट</CardTitle>
          </CardHeader>
          <CardContent>
            <InlineForm
              action={addVisitAction.bind(null, patientId)}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="visitDate">Date / तारीख</Label>
                  <Input id="visitDate" name="visitDate" type="date" defaultValue={today} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="visitWeight">Weight (kg)</Label>
                  <Input id="visitWeight" name="weightKg" type="number" step="0.1" placeholder="—" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="visitPain">Pain (1–10)</Label>
                  <Input id="visitPain" name="painScale" type="number" min="1" max="10" placeholder="—" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="progressNote">Progress note / प्रगती नोंद</Label>
                <Textarea id="progressNote" name="progressNote" rows={2} />
              </div>
              <Button type="submit" size="sm">Add visit / भेट जोडा</Button>
            </InlineForm>
          </CardContent>
        </Card>

        <ul className="space-y-2">
          {visits.length === 0 && (
            <li className="text-sm text-muted-foreground">No visits yet / भेटी नाहीत</li>
          )}
          {visits.map((v) => (
            <li key={v.id}>
              <Card>
                <CardContent className="pb-3 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{v.visitDate}</span>
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

async function Progress({ patientId }: { patientId: string }) {
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
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Not enough data / पुरेशी माहिती नाही
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Weight Trend / वजन (kg)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weightData.length >= 2 ? (
            <VisitLineChart data={weightData} color="var(--primary)" unit="kg" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough data / पुरेशी माहिती नाही
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pain Trend / वेदना पातळी
          </CardTitle>
        </CardHeader>
        <CardContent>
          {painData.length >= 2 ? (
            <VisitLineChart data={painData} color="var(--destructive)" unit="" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Not enough data / पुरेशी माहिती नाही
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 pt-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">First visit / पहिली भेट</p>
            <p className="font-medium">{firstDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Latest / शेवटची</p>
            <p className="font-medium">{latestDate ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Visits with data / माहिती</p>
            <p className="font-medium">{rows.length}</p>
          </div>
          {weightChange !== null && (
            <div>
              <p className="text-muted-foreground">Weight change / बदल</p>
              <p className="font-medium text-foreground">
                {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
              </p>
            </div>
          )}
          {painChange !== null && (
            <div>
              <p className="text-muted-foreground">Pain change / वेदना बदल</p>
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

async function Assessment({ patientId }: { patientId: string }) {
  const existing = await getLifestyleAssessment(getDb(), patientId);
  const selectClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="max-w-2xl space-y-6">
      <InlineForm
        action={saveLifestyleAssessmentAction.bind(null, patientId)}
        className="space-y-6"
      >
        {/* Section 1: Primary Concern */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Primary Concern / मुख्य तक्रार</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-chiefComplaint">What brings you here / कशासाठी आलात</Label>
              <Textarea
                id="a-chiefComplaint"
                name="chiefComplaint"
                rows={3}
                defaultValue={existing?.chiefComplaint ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-duration">Since when / केव्हापासून</Label>
              <Input
                id="a-duration"
                name="duration"
                placeholder="e.g. 2 months / २ महिने"
                defaultValue={existing?.duration ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-aggravatingFactors">What makes it worse / काय त्रास वाढवते</Label>
              <Textarea
                id="a-aggravatingFactors"
                name="aggravatingFactors"
                rows={2}
                defaultValue={existing?.aggravatingFactors ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-relievingFactors">What makes it better / काय आराम देते</Label>
              <Textarea
                id="a-relievingFactors"
                name="relievingFactors"
                rows={2}
                defaultValue={existing?.relievingFactors ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-previousTreatment">Previous treatments tried / आधी कोणते उपचार केले</Label>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Medications & Restrictions / औषधे</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-currentMedications">Current medications / सध्याची औषधे</Label>
              <Textarea
                id="a-currentMedications"
                name="currentMedications"
                rows={2}
                defaultValue={existing?.currentMedications ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-doctorDiagnosis">Doctor&apos;s diagnosis / डॉक्टरांचे निदान</Label>
              <Textarea
                id="a-doctorDiagnosis"
                name="doctorDiagnosis"
                rows={2}
                defaultValue={existing?.doctorDiagnosis ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-doctorRestrictions">
                Doctor&apos;s restrictions / डॉक्टरांनी काय टाळायला सांगितले
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lifestyle / जीवनशैली</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="a-workType">Work type / कामाचा प्रकार</Label>
                <select
                  id="a-workType"
                  name="workType"
                  defaultValue={existing?.workType ?? ''}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="desk">Desk job / बैठे काम</option>
                  <option value="standing">Standing / उभे राहणे</option>
                  <option value="physical">Physical labour / शारीरिक श्रम</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-dailySitting">Daily sitting / दररोज बसणे</Label>
                <select
                  id="a-dailySitting"
                  name="dailySitting"
                  defaultValue={existing?.dailySitting ?? ''}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="<2h">&lt;2 hrs</option>
                  <option value="2-4h">2–4 hrs</option>
                  <option value="4-8h">4–8 hrs</option>
                  <option value="8+h">8+ hrs</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-activityLevel">Activity level / सक्रियता</Label>
                <select
                  id="a-activityLevel"
                  name="activityLevel"
                  defaultValue={existing?.activityLevel ?? ''}
                  className={selectClass}
                >
                  <option value="">—</option>
                  <option value="sedentary">Sedentary / बैठी जीवनशैली</option>
                  <option value="light">Light / सौम्य</option>
                  <option value="active">Active / सक्रिय</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-sleepHours">Sleep hours / झोपेचे तास</Label>
                <Input
                  id="a-sleepHours"
                  name="sleepHours"
                  placeholder="e.g. 7"
                  defaultValue={existing?.sleepHours ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-sleepQuality">Sleep quality 1–10 / झोपेचा दर्जा</Label>
                <Input
                  id="a-sleepQuality"
                  name="sleepQuality"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue={existing?.sleepQuality?.toString() ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-stressLevel">Stress level 1–10 / ताण पातळी</Label>
                <Input
                  id="a-stressLevel"
                  name="stressLevel"
                  type="number"
                  min="1"
                  max="10"
                  defaultValue={existing?.stressLevel?.toString() ?? ''}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-screenTime">Screen time / स्क्रीन वेळ</Label>
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
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exercise History / व्यायामाचा इतिहास</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-previousExercise">Previous exercise / आधीचा व्यायाम</Label>
              <Input
                id="a-previousExercise"
                name="previousExercise"
                placeholder="e.g. yoga, walking / योग, चालणे"
                defaultValue={existing?.previousExercise ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-fitnessLevel">Fitness level / तंदुरुस्ती पातळी</Label>
              <select
                id="a-fitnessLevel"
                name="fitnessLevel"
                defaultValue={existing?.fitnessLevel ?? ''}
                className={selectClass}
              >
                <option value="">—</option>
                <option value="beginner">Beginner / नवीन</option>
                <option value="intermediate">Intermediate / मध्यम</option>
                <option value="active">Active / सक्रिय</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="fearOfMovement"
                value="true"
                defaultChecked={existing?.fearOfMovement ?? false}
                className="h-4 w-4 rounded border-input"
              />
              Afraid movement worsens pain? / हालचालीची भीती
            </label>
          </CardContent>
        </Card>

        {/* Section 5: Goals & Safety */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Goals & Safety / उद्दिष्टे आणि सुरक्षितता</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-primaryGoal">Primary goal / मुख्य उद्दिष्ट</Label>
              <Textarea
                id="a-primaryGoal"
                name="primaryGoal"
                rows={2}
                defaultValue={existing?.primaryGoal ?? ''}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-activityStruggle">Activity currently struggling with / अडचणीचे काम</Label>
              <Input
                id="a-activityStruggle"
                name="activityStruggle"
                placeholder="e.g. climbing stairs / जिने चढणे"
                defaultValue={existing?.activityStruggle ?? ''}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="hasContraindications"
                value="true"
                defaultChecked={existing?.hasContraindications ?? false}
                className="h-4 w-4 rounded border-input"
              />
              Any contraindications? / काही धोके?
            </label>
            <div className="space-y-1.5">
              <Label htmlFor="a-contraindicationDetails">Contraindication details / तपशील</Label>
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
          <Button type="submit">Save Assessment / सेव्ह करा</Button>
        </div>
      </InlineForm>
    </div>
  );
}
