import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const DEVANAGARI_REGEX = /[\u0900-\u097F]/;

function getAllSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllSourceFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('no-inline-marathi guard', () => {
  it('ensures no Devanagari characters are hardcoded in src/ outside lib/i18n/, clinics/, db/', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const allFiles = getAllSourceFiles(srcDir);

    const filesToCheck = allFiles.filter((filePath) => {
      const rel = path.relative(srcDir, filePath);
      if (
        rel.startsWith(`lib${path.sep}i18n${path.sep}`) ||
        rel === `lib${path.sep}i18n` ||
        rel.startsWith(`clinics${path.sep}`) ||
        rel === 'clinics' ||
        rel.startsWith(`db${path.sep}`) ||
        rel === 'db'
      ) {
        return false;
      }
      return true;
    });

    const violations: { file: string; line: number; snippet: string }[] = [];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (DEVANAGARI_REGEX.test(line)) {
          violations.push({
            file: path.relative(process.cwd(), file),
            line: index + 1,
            snippet: line.trim(),
          });
        }
      });
    }

    expect(
      violations,
      `Found inline Devanagari (Marathi) text in src/ outside allowed directories:\n${violations
        .map((v) => `  ${v.file}:${v.line}: ${v.snippet}`)
        .join('\n')}`
    ).toEqual([]);
  });
});
