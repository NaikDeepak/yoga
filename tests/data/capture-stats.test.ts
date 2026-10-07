import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../helpers/db';
import { recordCaptureCounts, listCaptureStats } from '@/data/capture-stats';
import type { Db } from '@/db/types';

let db: Db;
beforeEach(async () => { db = await createTestDb(); });

describe('recordCaptureCounts / listCaptureStats', () => {
  it('adds batches into one daily total per event and shot', async () => {
    await recordCaptureCounts(db, '2026-10-07', [{ event: 'captured', shot: 'front', n: 2 }, { event: 'saveTapped', shot: null, n: 1 }]);
    await recordCaptureCounts(db, '2026-10-07', [{ event: 'captured', shot: 'front', n: 3 }]);
    const rows = await listCaptureStats(db, '2026-10-01');
    expect(rows).toEqual(expect.arrayContaining([
      { event: 'captured', shot: 'front', count: 5 },
      { event: 'saveTapped', shot: '', count: 1 },
    ]));
    expect(rows).toHaveLength(2);
  });

  it('sums across days from the given day on, and leaves out older days', async () => {
    await recordCaptureCounts(db, '2026-09-01', [{ event: 'captured', shot: 'front', n: 9 }]);
    await recordCaptureCounts(db, '2026-10-06', [{ event: 'captured', shot: 'front', n: 1 }]);
    await recordCaptureCounts(db, '2026-10-07', [{ event: 'captured', shot: 'front', n: 1 }]);
    expect(await listCaptureStats(db, '2026-10-01')).toEqual([{ event: 'captured', shot: 'front', count: 2 }]);
  });
});
