import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PRIMARY = '#1F5F8B';
const ACCENT = '#2A9D8F';

function makeSvg(width: number, height: number): string {
  const cx = width / 2;
  const cy = height * 0.46;
  const radius = Math.min(width, height) * 0.22;
  const baseLineY = cy + radius * 0.3;
  const textY = cy + radius * 1.35;
  const fontSize = Math.round(Math.min(width, height) * 0.13);
  const strokeWidth = Math.max(2, Math.round(Math.min(width, height) * 0.02));

  const angles = [-60, -30, 0, 30, 60];
  const rays = angles
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const x1 = cx + radius * 1.25 * Math.sin(rad);
      const y1 = baseLineY - radius * 1.25 * Math.cos(rad);
      const x2 = cx + radius * 1.55 * Math.sin(rad);
      const y2 = baseLineY - radius * 1.55 * Math.cos(rad);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${ACCENT}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
    })
    .join('\n    ');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="${PRIMARY}"/>
    <line x1="${(cx - radius * 1.6).toFixed(1)}" y1="${baseLineY.toFixed(1)}" x2="${(cx + radius * 1.6).toFixed(1)}" y2="${baseLineY.toFixed(1)}" stroke="${ACCENT}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    <path d="M ${(cx - radius).toFixed(1)} ${baseLineY.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${(cx + radius).toFixed(1)} ${baseLineY.toFixed(1)} Z" fill="${ACCENT}"/>
    ${rays}
    <text x="${cx.toFixed(1)}" y="${textY.toFixed(1)}" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="700" fill="#FFFFFF" text-anchor="middle" letter-spacing="2">SP</text>
  </svg>`;
}

async function main() {
  const root = process.cwd();
  const sunriseDir = path.join(root, 'public', 'clinics', 'sunrise');
  const iconsDir = path.join(sunriseDir, 'icons');

  fs.mkdirSync(iconsDir, { recursive: true });

  const outputs = [
    { filePath: path.join(sunriseDir, 'logo.png'), width: 533, height: 468 },
    { filePath: path.join(iconsDir, 'icon-192.png'), width: 192, height: 192 },
    { filePath: path.join(iconsDir, 'icon-512.png'), width: 512, height: 512 },
    { filePath: path.join(iconsDir, 'icon-512-maskable.png'), width: 512, height: 512 },
  ];

  for (const item of outputs) {
    const svg = Buffer.from(makeSvg(item.width, item.height));
    await sharp(svg).png().toFile(item.filePath);
    console.log(`Generated: ${path.relative(root, item.filePath)} (${item.width}x${item.height})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
