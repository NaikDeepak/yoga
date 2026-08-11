'use client';

import { useState } from 'react';
import { useTranslations } from '@/lib/i18n/context';
import { savePrescribedExercisesAction } from '@/actions/exercises';
import { InlineForm } from '@/components/InlineForm';
import { SubmitButton } from '@/components/SubmitButton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Exercise } from '@/db/schema';
import type { PrescribedExercise } from '@/data/exercises';
import type { Locale } from '@/lib/i18n/translations';
import { ChevronDown, ChevronUp, Dumbbell, BookOpen } from 'lucide-react';

type PrescribedExercisesFormProps = {
  patientId: string;
  allExercises: Exercise[];
  initialPrescribed: PrescribedExercise[];
  locale: Locale;
};

export function PrescribedExercisesForm({
  patientId,
  allExercises,
  initialPrescribed,
  locale,
}: PrescribedExercisesFormProps) {
  const t = useTranslations();

  // State to track which exercises are selected, plus per-patient dose overrides
  type Selection = { selected: boolean; customNote: string; repetitions: string; daysPerWeek: string };
  const [selected, setSelected] = useState<Record<string, Selection>>(() => {
    const initialMap: Record<string, Selection> = {};
    // Populate all with defaults
    for (const ex of allExercises) {
      initialMap[ex.id] = { selected: false, customNote: '', repetitions: '', daysPerWeek: '' };
    }
    // Override with prescribed items
    for (const item of initialPrescribed) {
      initialMap[item.exerciseId] = {
        selected: true,
        customNote: item.customNote || '',
        repetitions: item.repetitionsOverride || '',
        daysPerWeek: item.daysPerWeekOverride || '',
      };
    }
    return initialMap;
  });

  // State to track expanded exercise details
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const handleCheckboxChange = (exerciseId: string, checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        selected: checked,
      },
    }));
  };

  const handleFieldChange = (exerciseId: string, field: 'customNote' | 'repetitions' | 'daysPerWeek', value: string) => {
    setSelected((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: value,
      },
    }));
  };

  const toggleExpanded = (exerciseId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [exerciseId]: !prev[exerciseId],
    }));
  };

  // Group exercises by category
  const categories = ['neck', 'back', 'core', 'lower_body', 'shoulder'] as const;
  const categoryLabels = {
    neck: { en: 'Neck Exercises', mr: 'मानेचे व्यायाम' },
    back: { en: 'Back Exercises', mr: 'पाठीचे व्यायाम' },
    core: { en: 'Core Exercises', mr: 'पोटाचे/गाभ्याचे व्यायाम' },
    lower_body: { en: 'Lower Body Exercises', mr: 'शरीराच्या खालच्या भागाचे व्यायाम' },
    shoulder: { en: 'Shoulder Exercises', mr: 'खांद्याचे व्यायाम' },
  };

  // Convert selected map to JSON for hidden form field
  const serializedSelection = JSON.stringify(
    Object.entries(selected)
      .filter(([_, value]) => value.selected)
      .map(([exerciseId, value]) => ({
        exerciseId,
        customNote: value.customNote.trim() || null,
        repetitions: value.repetitions.trim() || null,
        daysPerWeek: value.daysPerWeek.trim() || null,
      }))
  );

  return (
    <Card className="rounded-2xl border-border shadow-sm overflow-hidden bg-background">
      <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Dumbbell className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">
              {locale === 'mr' ? 'व्यायाम मार्गदर्शिका (Exercise Library)' : 'Exercise Library / व्यायाम मार्गदर्शिका'}
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === 'mr' ? 'साधकासाठी योग्य असणारे व्यायाम निवडा आणि सानुकूल सूचना जोडा.' : 'Select exercises and add custom instructions for the client.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <InlineForm
          action={savePrescribedExercisesAction.bind(null, patientId)}
          className="flex flex-col"
        >
          {/* Hidden JSON input */}
          <input type="hidden" name="prescribedExercisesJson" value={serializedSelection} />
          
          <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
            {categories.map((cat) => {
              const catExercises = allExercises.filter((ex) => ex.category === cat);
              if (catExercises.length === 0) return null;

              return (
                <div key={cat} className="p-4 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 px-2 py-1 rounded-md inline-block">
                    {locale === 'mr' ? categoryLabels[cat].mr : `${categoryLabels[cat].en} / ${categoryLabels[cat].mr}`}
                  </h3>

                  <div className="space-y-3">
                    {catExercises.map((ex) => {
                      const isSelected = selected[ex.id]?.selected ?? false;
                      const customNote = selected[ex.id]?.customNote ?? '';
                      const isExpanded = expanded[ex.id] ?? false;

                      return (
                        <div 
                          key={ex.id} 
                          className={`rounded-xl border p-3.5 transition-all duration-200 ${
                            isSelected 
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border/50 hover:border-border bg-card'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="pt-0.5">
                                <input
                                  type="checkbox"
                                  id={`ex-${ex.id}`}
                                  checked={isSelected}
                                  onChange={(e) => handleCheckboxChange(ex.id, e.target.checked)}
                                  className="h-4.5 w-4.5 rounded-sm border-muted-foreground/40 text-primary focus:ring-primary accent-primary cursor-pointer"
                                />
                              </div>
                              <div className="min-w-0 flex flex-col">
                                <label 
                                  htmlFor={`ex-${ex.id}`} 
                                  className="text-sm font-semibold text-foreground cursor-pointer select-none truncate"
                                >
                                  {locale === 'mr' ? ex.nameMr : ex.name}
                                </label>
                                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                  {locale === 'mr' 
                                    ? `वेळा: ${ex.repetitionsMr} | वारंवारता: ${ex.daysPerWeekMr}`
                                    : `Reps: ${ex.repetitions} | Freq: ${ex.daysPerWeek}`}
                                </span>
                              </div>
                            </div>
                            
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleExpanded(ex.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-full shrink-0"
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </Button>
                          </div>

                          {/* Per-patient dose overrides + custom note (visible when checked) */}
                          {isSelected && (
                            <div className="mt-3.5 pt-3 border-t border-dashed border-border/80 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label
                                    htmlFor={`reps-${ex.id}`}
                                    className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5"
                                  >
                                    {locale === 'mr' ? 'वेळा (साधकासाठी):' : 'Reps (for this client):'}
                                  </Label>
                                  <Input
                                    id={`reps-${ex.id}`}
                                    value={selected[ex.id]?.repetitions ?? ''}
                                    onChange={(e) => handleFieldChange(ex.id, 'repetitions', e.target.value)}
                                    placeholder={locale === 'mr' ? ex.repetitionsMr : ex.repetitions}
                                    className="h-9 text-xs rounded-lg border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary bg-background"
                                  />
                                </div>
                                <div>
                                  <Label
                                    htmlFor={`days-${ex.id}`}
                                    className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5"
                                  >
                                    {locale === 'mr' ? 'वारंवारता (साधकासाठी):' : 'Freq (for this client):'}
                                  </Label>
                                  <Input
                                    id={`days-${ex.id}`}
                                    value={selected[ex.id]?.daysPerWeek ?? ''}
                                    onChange={(e) => handleFieldChange(ex.id, 'daysPerWeek', e.target.value)}
                                    placeholder={locale === 'mr' ? ex.daysPerWeekMr : ex.daysPerWeek}
                                    className="h-9 text-xs rounded-lg border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary bg-background"
                                  />
                                </div>
                              </div>
                              <div>
                                <Label
                                  htmlFor={`note-${ex.id}`}
                                  className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5"
                                >
                                  {locale === 'mr' ? 'सानुकूल सूचना (उदा. ताण धरण्याची वेळ):' : 'Custom Note (e.g. holds, changes):'}
                                </Label>
                                <Input
                                  id={`note-${ex.id}`}
                                  value={customNote}
                                  onChange={(e) => handleFieldChange(ex.id, 'customNote', e.target.value)}
                                  placeholder={locale === 'mr' ? 'उदा. ५ सेकंद ऐवजी १० सेकंद ताण धरा' : 'e.g. Hold for 10s instead of 5s'}
                                  className="h-9 text-xs rounded-lg border-border focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary bg-background"
                                />
                              </div>
                            </div>
                          )}

                          {/* Collapsible Steps details */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div>
                                <p className="font-semibold text-foreground/80 mb-1 flex items-center gap-1.5">
                                  <BookOpen className="h-3 w-3 text-primary" />
                                  {locale === 'mr' ? 'कृती पायऱ्या:' : 'Step-by-step Directions:'}
                                </p>
                                <ol className="list-decimal list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
                                  {(locale === 'mr' ? ex.stepsMr : ex.steps).map((step, idx) => (
                                    <li key={idx} className="text-foreground/70">{step}</li>
                                  ))}
                                </ol>
                              </div>
                              
                              {(ex.tip || ex.tipMr) && (
                                <div className="mt-2.5 p-2 bg-muted/40 rounded-lg border border-border/30 text-[11px]">
                                  <span className="font-semibold text-foreground/80 block mb-0.5">
                                    {locale === 'mr' ? 'टीप / चेतावणी:' : 'Tip / Safety Warning:'}
                                  </span>
                                  <p className="italic text-foreground/60">{locale === 'mr' ? ex.tipMr : ex.tip}</p>
                                </div>
                              )}

                              {ex.imagePath && (
                                <div className="mt-2.5 flex justify-center bg-muted/10 border border-border/30 rounded-xl overflow-hidden p-2">
                                  <img 
                                    src={ex.imagePath} 
                                    alt={locale === 'mr' ? ex.nameMr : ex.name} 
                                    className="max-h-40 w-auto object-contain rounded-lg bg-white shadow-sm border border-border/20"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 bg-muted/10 border-t border-border/50 flex justify-end">
            <SubmitButton 
              size="sm" 
              pendingLabel={locale === 'mr' ? 'जतन करत आहे...' : 'Saving...'}
              className="rounded-full px-6 shadow-sm"
            >
              {locale === 'mr' ? 'व्यायाम जतन करा' : 'Save Exercises'}
            </SubmitButton>
          </div>
        </InlineForm>
      </CardContent>
    </Card>
  );
}
