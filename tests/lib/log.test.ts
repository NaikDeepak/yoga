import { describe, it, expect } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { safeErrorMessage } from '@/lib/log';

describe('safeErrorMessage', () => {
  it('never returns the SQL or parameters of a failed query (they hold patient data)', () => {
    const cause = Object.assign(new Error('duplicate key value violates unique constraint "flexibility_tests_assessment_shot_uq"'), {
      code: '23505', constraint: 'flexibility_tests_assessment_shot_uq',
    });
    const err = new DrizzleQueryError('insert into "flexibility_tests" ...', ['patients/abc/posture/x/flex.jpg', '{"x":0.5}'], cause);
    const msg = safeErrorMessage(err);
    expect(msg).toBe('Database error 23505 (flexibility_tests_assessment_shot_uq)');
    expect(msg).not.toMatch(/patients\/|insert|0\.5/);
  });

  it('a failed query without a Postgres code still hides the SQL', () => {
    expect(safeErrorMessage(new DrizzleQueryError('select 1', ['secret'], new Error('fetch failed')))).toBe('Database error');
  });

  it('keeps ordinary messages and stringifies non-errors', () => {
    expect(safeErrorMessage(new Error('3 file(s) could not be deleted'))).toBe('3 file(s) could not be deleted');
    expect(safeErrorMessage('boom')).toBe('boom');
  });
});
