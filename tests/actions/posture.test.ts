import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../helpers/action-mocks';
import { freshTestDb, storage } from '../helpers/action-mocks';
import { alignedLandmarks, jpeg } from '../helpers/posture';
import { savePostureAssessmentAction, deletePostureAssessmentAction } from '@/actions/posture';
import { createPatient } from '@/data/patients';
import { addPostureAssessment, listPostureAssessments, getPostureAssessment } from '@/data/posture';
import { requireUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { POSTURE_VIEWS, type PostureView } from '@/lib/posture';
import type { Db } from '@/db/types';

let db: Db;
let patientId: string;

beforeEach(async () => {
  db = await freshTestDb();
  vi.mocked(revalidatePath).mockClear();
  patientId = (await createPatient(db, { fullName: 'Asha', mobile: '9876543210', heightCm: 160 })).id;
});

const viewPayload = (v: PostureView) => ({
  view: v, imageWidth: 1000, imageHeight: 2000, landmarks: alignedLandmarks(v), landmarksEdited: false,
  cameraCheck: { method: 'sensor' as const, rollDeg: 0.4, pitchDeg: -1 },
});

function form(
  payload: Record<string, unknown> = {},
  photos: Partial<Record<PostureView, File | null>> = {},
): FormData {
  const f = new FormData();
  f.set('payload', JSON.stringify({
    consent: true, assessedOn: '2026-10-04', note: 'Baseline', views: POSTURE_VIEWS.map(viewPayload), ...payload,
  }));
  for (const v of POSTURE_VIEWS) {
    const photo = v in photos ? photos[v] : jpeg(`${v}.jpg`);
    if (photo) f.set(`photo_${v}`, photo);
  }
  return f;
}

async function save(fd: FormData, id = patientId) {
  try {
    return await savePostureAssessmentAction(id, fd);
  } catch (e) {
    return { redirect: (e as Error).message.replace('REDIRECT:', '') };
  }
}

describe('savePostureAssessmentAction', () => {
  it('saves all four views with the client height snapshot and opens the report', async () => {
    const r = await save(form());
    const [a] = await listPostureAssessments(db, patientId);
    expect(r).toEqual({ redirect: `/patients/${patientId}/posture/${a.id}` });
    expect(a).toMatchObject({ assessedOn: '2026-10-04', heightCm: 160, note: 'Baseline' });
    expect(a.consentAt).toBeInstanceOf(Date);
    expect(storage.files.size).toBe(4);
    expect(revalidatePath).toHaveBeenCalledWith(`/patients/${patientId}`);
  });

  it('ignores any metrics the client sends and computes its own', async () => {
    const views = POSTURE_VIEWS.map((v) => ({ ...viewPayload(v), metrics: [{ key: 'shoulderLevel', value: 99 }] }));
    await save(form({ views }));
    const [summary] = await listPostureAssessments(db, patientId);
    const a = await getPostureAssessment(db, summary.id);
    expect(a!.views[0].metrics.find((m) => m.key === 'shoulderLevel')?.value).toBe(0);
  });

  it('stores no height when the client has none recorded', async () => {
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    await save(form(), otherId);
    const [a] = await listPostureAssessments(db, otherId);
    expect(a.heightCm).toBeNull();
  });

  it('requires photo consent', async () => {
    expect(await save(form({ consent: false }))).toEqual({ ok: false, error: 'Photo consent required / फोटोसाठी संमती आवश्यक' });
  });

  it('rejects a missing or unparseable payload', async () => {
    const msg = { ok: false, error: 'Invalid posture data / चुकीची पोश्चर माहिती' };
    const broken = form(); broken.set('payload', '{not json');
    expect(await save(broken)).toEqual(msg);
    const missing = form(); missing.delete('payload');
    expect(await save(missing)).toEqual(msg);
  });

  it('requires a photo for every view', async () => {
    expect(await save(form({}, { back: null }))).toEqual({
      ok: false, error: 'Photo for each view required / प्रत्येक बाजूचा फोटो आवश्यक',
    });
    const empty = new File([], 'back.jpg', { type: 'image/jpeg' });
    expect(await save(form({}, { back: empty }))).toMatchObject({ ok: false });
  });

  it('rejects non-image photos', async () => {
    const pdf = new File([new Uint8Array([1])], 'x.pdf', { type: 'application/pdf' });
    expect(await save(form({}, { left: pdf }))).toEqual({
      ok: false, error: 'Photo must be JPG or PNG / फोटो JPG किंवा PNG हवा',
    });
  });

  it('caps the combined size of the four photos', async () => {
    const big = (v: PostureView) => new File([new Uint8Array(1.1 * 1024 * 1024)], `${v}.jpg`, { type: 'image/jpeg' });
    const r = await save(form({}, Object.fromEntries(POSTURE_VIEWS.map((v) => [v, big(v)]))));
    expect(r).toEqual({ ok: false, error: 'Photos too large, max 4 MB total / फोटो खूप मोठे, एकूण 4 MB पर्यंत' });
    expect(storage.files.size).toBe(0);
  });

  it('rejects an unknown client and bad parameters', async () => {
    expect(await save(form(), '00000000-0000-0000-0000-000000000000')).toEqual({
      ok: false, error: 'Client not found / साधक सापडला नाही',
    });
    expect(await save(form(), '')).toEqual({ ok: false, error: 'Invalid parameters / अवैध पॅरामीटर्स' });
  });

  it('reports a storage failure without leaving anything behind', async () => {
    storage.failNextUpload = true;
    expect(await save(form())).toEqual({
      ok: false, error: 'Could not save posture assessment / पोश्चर मूल्यांकन जतन करता आले नाही',
    });
    expect(await listPostureAssessments(db, patientId)).toEqual([]);
  });

  it('requires a signed-in user', async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('REDIRECT:/login'));
    await expect(savePostureAssessmentAction(patientId, form())).rejects.toThrow('REDIRECT:/login');
    expect(storage.files.size).toBe(0);
  });
});

describe('deletePostureAssessmentAction', () => {
  const addOne = (id = patientId) => addPostureAssessment(db, storage, {
    patientId: id, assessedOn: '2026-10-04', heightCm: null, note: null, consentAt: new Date(),
    views: POSTURE_VIEWS.map((v) => ({ ...viewPayload(v), photo: jpeg() })),
  });

  it('deletes the assessment and its photos', async () => {
    const { id } = await addOne();
    expect(await deletePostureAssessmentAction(patientId, id)).toEqual({ ok: true });
    expect(await listPostureAssessments(db, patientId)).toEqual([]);
    expect(storage.files.size).toBe(0);
    expect(revalidatePath).toHaveBeenCalledWith(`/patients/${patientId}`);
  });

  it("leaves another client's assessment alone", async () => {
    const { id } = await addOne();
    const otherId = (await createPatient(db, { fullName: 'Ravi', mobile: '9876500000' })).id;
    expect(await deletePostureAssessmentAction(otherId, id)).toEqual({ ok: true });
    expect(await getPostureAssessment(db, id)).not.toBeNull();
  });

  it('rejects bad parameters', async () => {
    expect(await deletePostureAssessmentAction('', 'x')).toEqual({ ok: false, error: 'Invalid parameters / अवैध पॅरामीटर्स' });
    expect(await deletePostureAssessmentAction(patientId, '')).toEqual({ ok: false, error: 'Invalid parameters / अवैध पॅरामीटर्स' });
  });

  it('reports a delete failure', async () => {
    const { id } = await addOne();
    const remove = vi.spyOn(storage, 'remove').mockRejectedValueOnce(new Error('storage down'));
    expect(await deletePostureAssessmentAction(patientId, id)).toEqual({
      ok: false, error: 'Could not delete posture assessment / पोश्चर मूल्यांकन हटवता आले नाही',
    });
    remove.mockRestore();
  });
});
