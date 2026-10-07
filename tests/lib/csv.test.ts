import { describe, it, expect } from 'vitest';
import { toCsv, csvFilename } from '@/lib/csv';

describe('toCsv', () => {
  it('starts with UTF-8 BOM and separates lines with CRLF', () => {
    const csv = toCsv(['Col1', 'Col2'], [['Val1', 'Val2']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFCol1,Col2\r\nVal1,Val2');
  });

  it('quotes fields containing comma, quote, and newlines', () => {
    const csv = toCsv(
      ['Header'],
      [
        ['hello, world'],
        ['say "hi"'],
        ['line1\nline2'],
        ['line1\r\nline2'],
      ],
    );
    expect(csv).toBe('\uFEFFHeader\r\n"hello, world"\r\n"say ""hi"""\r\n"line1\nline2"\r\n"line1\r\nline2"');
  });

  it('renders null and undefined as empty cells', () => {
    const csv = toCsv(
      ['A', 'B', 'C'],
      [
        ['val', null, 'other'],
        [null, null, null],
      ],
    );
    expect(csv).toBe('\uFEFFA,B,C\r\nval,,other\r\n,,');
  });

  it('applies formula-injection guard to strings starting with =, +, -, @, tab, or CR, but keeps numbers un-prefixed', () => {
    const csv = toCsv(
      ['Formula', 'Number'],
      [
        ['=SUM(1)', -2],
        ['+1', 42],
        ['-2', 0],
        ['@x', -100],
        ['\talert', 5],
        ['\rsecret', 9],
      ],
    );
    expect(csv).toContain("'=SUM(1),-2");
    expect(csv).toContain("'+1,42");
    expect(csv).toContain("'-2,0");
    expect(csv).toContain("'@x,-100");
    expect(csv).toContain("'\talert,5");
    // cell with '\r' contains a CR, so it is quoted per RFC 4180
    expect(csv).toContain("\"'\rsecret\",9");
  });

  it('leaves Marathi text unchanged', () => {
    const csv = toCsv(
      ['नाव', 'तक्रार'],
      [['आशा पवार', 'कंबर दुखी; मान दुखी']],
    );
    expect(csv).toBe('\uFEFFनाव,तक्रार\r\nआशा पवार,कंबर दुखी; मान दुखी');
  });
});

describe('csvFilename', () => {
  it('formats filename with kind and ISO date', () => {
    expect(csvFilename('clients', '2026-10-07')).toBe('clients-2026-10-07.csv');
    expect(csvFilename('visits', '2026-10-07')).toBe('visits-2026-10-07.csv');
    expect(csvFilename('fees', '2026-10-07')).toBe('fees-2026-10-07.csv');
  });
});
