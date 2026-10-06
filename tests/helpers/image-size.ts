import { readFileSync } from 'node:fs';

/** Width/height of a JPEG (baseline or progressive), from its SOF marker. Test helper; no dependency. */
export function imageSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error(`Not a JPEG: ${file}`);
  let i = 2;
  while (i + 3 < b.length) {
    if (b[i] !== 0xff) throw new Error(`Bad JPEG marker in ${file}`);
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte before a marker
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; } // standalone markers
    const len = b.readUInt16BE(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isSof && i + 8 < b.length) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error(`No JPEG size in ${file}`);
}
