import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/db/client';
import { searchPatients } from '@/data/patients';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized / अनधिकृत' }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const db = getDb();
  const matches = await searchPatients(db, q, 8);
  return NextResponse.json({
    results: matches.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      patientCode: p.patientCode,
      mobile: p.mobile,
    })),
  });
}
