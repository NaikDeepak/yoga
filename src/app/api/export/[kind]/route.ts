import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { safeErrorMessage } from '@/lib/log';
import { getDb } from '@/db/client';
import { exportClients, exportVisits, exportFees, type ExportResult } from '@/data/export';
import { toCsv, csvFilename } from '@/lib/csv';
import { getISTDateString } from '@/lib/dates';
import { BRANCHES } from '@/lib/presets';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });
    }

    const { kind } = await params;
    if (kind !== 'clients' && kind !== 'visits' && kind !== 'fees') {
      return NextResponse.json({ error: 'Not found / सापडले नाही' }, { status: 404 });
    }

    const url = new URL(req.url);
    const branchParam = url.searchParams.get('branch')?.trim() || undefined;
    if (branchParam && !BRANCHES.some((b) => b.key === branchParam)) {
      return NextResponse.json({ error: 'Invalid branch / चुकीची शाखा' }, { status: 400 });
    }

    const db = getDb();
    let data: ExportResult;

    if (kind === 'clients') {
      data = await exportClients(db, { branch: branchParam });
    } else if (kind === 'visits') {
      data = await exportVisits(db, { branch: branchParam });
    } else {
      data = await exportFees(db, { branch: branchParam });
    }

    // AUDIT: export recorded here (wired by Claude)
    const csv = toCsv(data.header, data.rows);
    const today = getISTDateString(0);
    const filename = csvFilename(kind, today);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('CSV export failed:', safeErrorMessage(err));
    return NextResponse.json({ error: 'Export failed / निर्यात अयशस्वी झाली' }, { status: 500 });
  }
}
