'use client';

import { useState, useTransition } from 'react';
import { Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { InlineForm } from '@/components/InlineForm';
import { useTranslations } from '@/lib/i18n/context';
import { generatePostureAiAction, savePostureAiAction } from '@/actions/posture';
import { formatFullDate } from '@/lib/dates';
import type { PostureAiReport } from '@/lib/posture-ai';
import { BRAND } from './ReportParts';
import { AddToPrescriptionButton } from './AddToPrescriptionButton';

type ListKey = 'lifestyleLinks' | 'likelyCauses' | 'risks';
type RecKey = keyof PostureAiReport['recommendations'];

/** AI analysis section of the posture report: generate → read → edit & approve. */
export function PostureAiPanel({
  patientId,
  assessmentId,
  report,
  approvedAt,
  recommendedExerciseIds = [],
}: {
  patientId: string;
  assessmentId: string;
  report: PostureAiReport | null;
  approvedAt: string | null; // ISO date (yyyy-mm-dd) when the therapist approved it
  /** Library ids of the exercises the analysis recommends (for "add to prescription"). */
  recommendedExerciseIds?: string[];
}) {
  const t = useTranslations();
  const a = t.posture.ai;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  const generate = () => {
    setError(null);
    startGenerating(async () => {
      const result = await generatePostureAiAction(patientId, assessmentId);
      if (!result.ok) setError(result.error);
    });
  };

  const generateButton = (
    <Button variant={report ? 'outline' : 'default'} size="sm" onClick={generate} disabled={generating}>
      {report ? <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" /> : <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />}
      {report ? a.regenerate : a.generate}
    </Button>
  );

  if (!report) {
    return (
      <div className="rounded-lg border p-4 print:hidden" style={{ borderColor: BRAND.sand }}>
        <p className="mb-3 text-sm text-gray-600">{a.privacyNote}</p>
        {generateButton}
        {generating && <p className="mt-2 text-sm text-muted-foreground">{a.generating}</p>}
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  if (editing) {
    const asLines = (xs: string[]) => xs.join('\n');
    const field = (name: string, label: string, value: string, rows = 3) => (
      <div className="space-y-1">
        <Label htmlFor={`ai-${name}`}>{label}</Label>
        <Textarea id={`ai-${name}`} name={name} defaultValue={value} rows={rows} />
      </div>
    );
    return (
      <div className="rounded-lg border p-4 print:hidden" style={{ borderColor: BRAND.sand }}>
        <p className="mb-3 text-xs text-gray-500">{a.editHelp}</p>
        <InlineForm
          resetOnSuccess={false}
          className="space-y-3"
          action={async (fd) => {
            const result = await savePostureAiAction(patientId, assessmentId, { ok: false, error: '' }, fd);
            if (result.ok) setEditing(false);
            return result;
          }}
        >
          {field('summary', a.sections.summary, report.summary, 4)}
          {field('keyFindings', a.sections.keyFindings, asLines(report.keyFindings.map((f) => `${f.title}: ${f.explanation}`)), 5)}
          {field('lifestyleLinks', a.sections.lifestyleLinks, asLines(report.lifestyleLinks))}
          {field('likelyCauses', a.sections.likelyCauses, asLines(report.likelyCauses))}
          {field('risks', a.sections.risks, asLines(report.risks))}
          {field('exercises', a.sections.exercises, asLines(report.recommendations.exercises))}
          {field('ergonomics', a.sections.ergonomics, asLines(report.recommendations.ergonomics))}
          {field('yogaAndBreathing', a.sections.yogaAndBreathing, asLines(report.recommendations.yogaAndBreathing))}
          {field('followUp', a.sections.followUp, report.followUp, 2)}
          <div className="flex gap-2">
            <Button type="submit" size="sm">{a.save}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{a.cancel}</Button>
          </div>
        </InlineForm>
      </div>
    );
  }

  const list = (key: ListKey) => report[key];
  const rec = (key: RecKey) => report.recommendations[key];
  const Bullets = ({ title, items }: { title: string; items: string[] }) => items.length === 0 ? null : (
    <div className="print:break-inside-avoid">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-sm text-gray-700">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );

  return (
    <div className="space-y-4 rounded-lg border p-4" style={{ borderColor: BRAND.sand, backgroundColor: BRAND.sandLight }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={approvedAt ? { backgroundColor: '#E6F0EA', color: BRAND.green } : { backgroundColor: '#FBF1DC', color: '#8A5A00' }}
        >
          {approvedAt
            ? a.approved.replace('{date}', formatFullDate(approvedAt))
            : <><span className="print:hidden">{a.draft}</span><span className="hidden print:inline">{a.printDraft}</span></>}
        </span>
        <div className="flex gap-2 print:hidden">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={generating}>
            <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {a.edit}
          </Button>
          {generateButton}
        </div>
      </div>
      {generating && <p className="text-sm text-muted-foreground print:hidden">{a.generating}</p>}
      {error && <p role="alert" className="text-sm text-destructive print:hidden">{error}</p>}

      <p className="text-sm leading-relaxed text-gray-800">{report.summary}</p>

      <div className="print:break-inside-avoid">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{a.sections.keyFindings}</p>
        <ul className="space-y-1.5 text-sm">
          {report.keyFindings.map((f) => (
            <li key={f.title}><span className="font-semibold" style={{ color: BRAND.green }}>{f.title}</span> — <span className="text-gray-700">{f.explanation}</span></li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        <Bullets title={a.sections.lifestyleLinks} items={list('lifestyleLinks')} />
        <Bullets title={a.sections.likelyCauses} items={list('likelyCauses')} />
        <Bullets title={a.sections.risks} items={list('risks')} />
        <Bullets title={a.sections.exercises} items={rec('exercises')} />
        <Bullets title={a.sections.ergonomics} items={rec('ergonomics')} />
        <Bullets title={a.sections.yogaAndBreathing} items={rec('yogaAndBreathing')} />
      </div>

      <AddToPrescriptionButton patientId={patientId} exerciseIds={recommendedExerciseIds} label={t.posture.prescribe.addAi} />

      <p className="text-sm"><span className="font-semibold" style={{ color: BRAND.green }}>{a.sections.followUp}:</span> {report.followUp}</p>
    </div>
  );
}
