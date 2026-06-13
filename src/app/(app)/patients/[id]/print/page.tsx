import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { getPatient } from '@/data/patients';
import { listProblems } from '@/data/problems';
import { getTreatmentPlan } from '@/data/treatment';
import { listVisits } from '@/data/visits';
import { getLifestyleAssessment } from '@/data/lifestyle';
import { computeBmi, bmiCategory } from '@/lib/bmi';
import { PrintButton } from '@/components/PrintButton';

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const patient = await getPatient(db, id);
  if (!patient) notFound();
  const [problems, plan, visits, assessment] = await Promise.all([
    listProblems(db, id), getTreatmentPlan(db, id), listVisits(db, id), getLifestyleAssessment(db, id),
  ]);
  const bmi = computeBmi(patient.weightKg, patient.heightCm);
  const planRows = plan ? ([
    ['Yoga Program / योग कार्यक्रम', plan.yogaProgram], ['Pranayam / प्राणायाम', plan.pranayam],
    ['Massage / मसाज', plan.massage], ['Yoga Therapy / योग थेरपी', plan.yogaTherapy],
    ['Diet Plan / आहार योजना', plan.dietPlan], ['Medicines / औषधे', plan.medicines],
    ['Panchkarma / पंचकर्म', plan.panchkarma],
  ] as const).filter(([, v]) => v) : [];

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      <header className="mb-6 border-b-2 pb-3 text-center" style={{ borderColor: '#4A7548' }}>
        <div className="mb-1 flex items-center justify-center gap-2">
          <span className="text-2xl" aria-hidden="true">🌿</span>
          <h1 className="text-2xl font-bold" style={{ color: '#2C2418' }}>Pawar Yoga Therapy Center</h1>
        </div>
        <p className="text-sm" style={{ color: '#7A6E62' }}>Patient Summary / रुग्ण सारांश — {patient.patientCode}</p>
      </header>

      <section className="mb-6">
        <h2 className="mb-2 border-b border-stone-300 font-semibold">Registration / नोंदणी</h2>
        <table className="w-full text-sm">
          <tbody>
            {([
              ['Name / नाव', patient.fullName], ['Age / वय', patient.age], ['Gender / लिंग', patient.gender],
              ['Weight / वजन', patient.weightKg && `${patient.weightKg} kg`],
              ['Height / उंची', patient.heightCm && `${patient.heightCm} cm`],
              ['BMI', bmi !== null ? `${bmi} — ${bmiCategory(bmi)}` : null],
              ['Mobile / मोबाईल', patient.mobile], ['Email / ईमेल', patient.email],
              ['Address / पत्ता', patient.address], ['Occupation / व्यवसाय', patient.occupation],
              ['Emergency / आपत्कालीन', patient.emergencyContact],
            ] as const).filter(([, v]) => v != null).map(([k, v]) => (
              <tr key={k} className="border-b border-stone-100">
                <td className="w-48 py-1 text-stone-500">{k}</td>
                <td className="py-1">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 border-b border-stone-300 font-semibold">Health Problems / आजार</h2>
        {problems.length === 0
          ? <p className="text-sm text-stone-500">None recorded / नोंद नाही</p>
          : <ul className="list-inside list-disc text-sm">
              {problems.map((p) => <li key={p.id}>{p.problem}{p.note && ` — ${p.note}`}</li>)}
            </ul>}
      </section>

      {assessment && (() => {
        const concern = ([
          ['Chief Complaint / मुख्य तक्रार', assessment.chiefComplaint],
          ['Since / केव्हापासून', assessment.duration],
          ['Aggravating Factors / काय त्रास वाढवते', assessment.aggravatingFactors],
          ['Relieving Factors / काय आराम देते', assessment.relievingFactors],
          ['Previous Treatment / आधीचे उपचार', assessment.previousTreatment],
        ] as const).filter(([, v]) => v);
        const meds = ([
          ['Current Medications / सध्याची औषधे', assessment.currentMedications],
          ["Doctor's Diagnosis / डॉक्टरांचे निदान", assessment.doctorDiagnosis],
          ["Doctor's Restrictions / डॉक्टरांचे निर्बंध", assessment.doctorRestrictions],
        ] as const).filter(([, v]) => v);
        const goalRows: [string, string][] = (([
          ['Primary Goal / मुख्य उद्दिष्ट', assessment.primaryGoal],
          assessment.hasContraindications != null
            ? ['Contraindications / विरोधाभास', assessment.hasContraindications ? 'Yes / होय ⚠' : 'No / नाही']
            : null,
          ['Details / तपशील', assessment.contraindicationDetails],
        ]) as ([string, string | null] | null)[]).filter((r): r is [string, string] => r != null && r[1] != null);
        return (
          <>
            {concern.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 border-b border-stone-300 font-semibold">Primary Concern / मुख्य तक्रार</h2>
                <table className="w-full text-sm"><tbody>
                  {concern.map(([k, v]) => (
                    <tr key={k} className="border-b border-stone-100 align-top">
                      <td className="w-48 py-1 text-stone-500">{k}</td>
                      <td className="py-1 whitespace-pre-wrap">{v}</td>
                    </tr>
                  ))}
                </tbody></table>
              </section>
            )}
            {meds.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 border-b border-stone-300 font-semibold">Medications & Restrictions / औषधे आणि निर्बंध</h2>
                <table className="w-full text-sm"><tbody>
                  {meds.map(([k, v]) => (
                    <tr key={k} className="border-b border-stone-100 align-top">
                      <td className="w-48 py-1 text-stone-500">{k}</td>
                      <td className="py-1 whitespace-pre-wrap">{v}</td>
                    </tr>
                  ))}
                </tbody></table>
              </section>
            )}
            {goalRows.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 border-b border-stone-300 font-semibold">Goals & Safety / उद्दिष्टे आणि सुरक्षितता</h2>
                <table className="w-full text-sm"><tbody>
                  {goalRows.map(([k, v]) => (
                    <tr key={k} className="border-b border-stone-100 align-top">
                      <td className="w-48 py-1 text-stone-500">{k}</td>
                      <td className={`py-1 whitespace-pre-wrap${v.includes('⚠') ? ' font-medium text-red-600' : ''}`}>{v}</td>
                    </tr>
                  ))}
                </tbody></table>
              </section>
            )}
          </>
        );
      })()}

      {planRows.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 border-b border-stone-300 font-semibold">Treatment Plan / उपचार योजना</h2>
          <table className="w-full text-sm">
            <tbody>
              {planRows.map(([k, v]) => (
                <tr key={k} className="border-b border-stone-100 align-top">
                  <td className="w-48 py-1 text-stone-500">{k}</td>
                  <td className="py-1 whitespace-pre-wrap">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2 className="mb-2 border-b border-stone-300 font-semibold">Visit History / भेटींचा इतिहास</h2>
        {visits.length === 0
          ? <p className="text-sm text-stone-500">No visits / भेटी नाहीत</p>
          : <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-300 text-left text-stone-500">
                  <th className="py-1">Date</th><th>Weight</th><th>Pain</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id} className="border-b border-stone-100 align-top">
                    <td className="py-1 whitespace-nowrap">{v.visitDate}</td>
                    <td>{v.weightKg ?? '—'}</td>
                    <td>{v.painScale ? `${v.painScale}/10` : '—'}</td>
                    <td className="whitespace-pre-wrap">{v.progressNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </section>
      <footer className="mt-8 border-t border-stone-200 pt-2 text-center text-xs text-stone-400 print:fixed print:bottom-0 print:left-0 print:right-0">
        Generated on {new Date().toLocaleDateString('en-IN')} — Pawar Yoga Therapy Center
      </footer>
    </div>
  );
}
