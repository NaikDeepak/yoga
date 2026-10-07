// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import AppError from '@/app/error';
import NotFound from '@/app/not-found';
import { en } from '@/lib/i18n/en';
import { mr } from '@/lib/i18n/mr';

afterEach(cleanup);

describe('error page', () => {
  it('shows the message in English and Marathi, and "try again" calls reset', () => {
    const reset = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppError error={Object.assign(new Error('boom: Asha Kulkarni'), { digest: 'd1' })} reset={reset} />);
    expect(screen.getByText(en.errors.errorTitle)).toBeTruthy();
    expect(screen.getByText(mr.errors.errorTitle)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(en.errors.retry) }));
    expect(reset).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: new RegExp(en.errors.home) }).getAttribute('href')).toBe('/dashboard');
  });

  it('never shows the raw error message (it may hold client data)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppError error={new Error('boom: Asha Kulkarni')} reset={() => {}} />);
    expect(document.body.textContent).not.toContain('Asha');
  });

  it('shows the error reference so a bug report can be matched to the server log', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AppError error={Object.assign(new Error('x'), { digest: 'abc123' })} reset={() => {}} />);
    expect(document.body.textContent).toContain('abc123');
  });
});

describe('not-found page', () => {
  it('is bilingual with a way home', () => {
    render(<NotFound />);
    expect(screen.getByText(en.errors.notFoundTitle)).toBeTruthy();
    expect(screen.getByText(mr.errors.notFoundTitle)).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(en.errors.home) }).getAttribute('href')).toBe('/dashboard');
  });
});
