// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportCard } from '@/components/ExportCard';
import { en } from '@/lib/i18n/en';

describe('ExportCard', () => {
  it('renders download links pointing to base export URLs by default', () => {
    render(<ExportCard t={en} />);

    expect(screen.getByText(en.export.title)).toBeTruthy();
    expect(screen.getByText(en.export.description)).toBeTruthy();

    const clientsLink = screen.getByRole('link', { name: new RegExp(en.export.clients, 'i') });
    const visitsLink = screen.getByRole('link', { name: new RegExp(en.export.visits, 'i') });
    const feesLink = screen.getByRole('link', { name: new RegExp(en.export.fees, 'i') });

    expect(clientsLink.getAttribute('href')).toBe('/api/export/clients');
    expect(visitsLink.getAttribute('href')).toBe('/api/export/visits');
    expect(feesLink.getAttribute('href')).toBe('/api/export/fees');

    expect(clientsLink.hasAttribute('download')).toBe(true);
    expect(visitsLink.hasAttribute('download')).toBe(true);
    expect(feesLink.hasAttribute('download')).toBe(true);
  });

  it('updates all download links when branch is selected', () => {
    render(<ExportCard t={en} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Kharadi' } });

    const clientsLink = screen.getByRole('link', { name: new RegExp(en.export.clients, 'i') });
    const visitsLink = screen.getByRole('link', { name: new RegExp(en.export.visits, 'i') });
    const feesLink = screen.getByRole('link', { name: new RegExp(en.export.fees, 'i') });

    expect(clientsLink.getAttribute('href')).toBe('/api/export/clients?branch=Kharadi');
    expect(visitsLink.getAttribute('href')).toBe('/api/export/visits?branch=Kharadi');
    expect(feesLink.getAttribute('href')).toBe('/api/export/fees?branch=Kharadi');

    // Switch back to All branches
    fireEvent.change(select, { target: { value: '' } });
    expect(clientsLink.getAttribute('href')).toBe('/api/export/clients');
    expect(visitsLink.getAttribute('href')).toBe('/api/export/visits');
    expect(feesLink.getAttribute('href')).toBe('/api/export/fees');
  });
});
