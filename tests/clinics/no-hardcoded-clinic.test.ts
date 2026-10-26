import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CLINIC_REGISTRY } from '@/clinics';
import { FORBIDDEN } from '../helpers/pawar-identity';


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

describe('no-hardcoded-clinic guard', () => {
  it('ensures no Pawar-specific strings are hardcoded in src/ outside clinics/ (case-insensitive)', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const allFiles = getAllSourceFiles(srcDir);

    const filesToCheck = allFiles.filter((filePath) => {
      const rel = path.relative(srcDir, filePath);
      if (rel.startsWith(`clinics${path.sep}`) || rel === 'clinics') return false;
      return true;
    });

    const violations: { file: string; line: number; term: string; snippet: string }[] = [];

    for (const file of filesToCheck) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        for (const term of FORBIDDEN) {
          if (line.toLowerCase().includes(term.toLowerCase())) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: index + 1,
              term,
              snippet: line.trim(),
            });
          }
        }
      });
    }

    expect(
      violations,
      `Found hardcoded clinic details in src/:\n${violations
        .map((v) => `  ${v.file}:${v.line} [found "${v.term}"]: ${v.snippet}`)
        .join('\n')}`
    ).toEqual([]);
  });
});

describe.each(Object.entries(CLINIC_REGISTRY))('clinic assets of %s', (_slug, profile) => {
  it('every file the profile points at exists in public/', () => {
    const paths = [profile.logo.src, ...Object.values(profile.icons)];
    for (const p of paths) expect(fs.existsSync(path.join(process.cwd(), 'public', p)), p).toBe(true);
  });
});
