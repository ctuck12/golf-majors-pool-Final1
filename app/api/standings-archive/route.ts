export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import redis from '@/app/lib/redis';

// Archive of the pool's OWN final standings, one snapshot per (tournament, season year).
// The standings are computed on the client, so the client posts the final table here when a
// tournament is complete; members can then view any banked year. First season = 2026.

const TOURNAMENT_IDS = new Set(['players', 'masters', 'pga', 'us-open', 'open']);

type ArchiveGolfer = { name: string; score: string; points: number; position: string; salary: number };
type ArchiveRow = { place: number; name: string; points: number; holesRemaining: number; tieBreak: number; golfers?: ArchiveGolfer[] };
type ArchivePayouts = { first?: number; second?: number; third?: number };

const rowKey = (tid: string, year: number) => `standings-archive:v1:${tid}:${year}`;
const yearsKey = (tid: string) => `standings-archive-years:v1:${tid}`;

async function getYears(tid: string): Promise<number[]> {
  try {
    const raw = await redis.get(yearsKey(tid));
    if (!raw) return [];
    const arr = JSON.parse(raw as string) as number[];
    return Array.isArray(arr) ? arr.filter((y) => typeof y === 'number').sort((a, b) => b - a) : [];
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tid = searchParams.get('tournamentId') ?? '';
  if (!TOURNAMENT_IDS.has(tid)) return Response.json({ error: 'unknown tournament' }, { status: 400 });

  const yearParam = searchParams.get('year');
  if (!yearParam) {
    // List the banked years for this tournament.
    return Response.json({ tournamentId: tid, years: await getYears(tid) });
  }
  const year = parseInt(yearParam, 10);
  if (isNaN(year)) return Response.json({ error: 'bad year' }, { status: 400 });
  try {
    const raw = await redis.get(rowKey(tid, year));
    if (!raw) return Response.json({ tournamentId: tid, year, available: false, standings: [] });
    const data = JSON.parse(raw as string) as { standings: ArchiveRow[]; savedAt: string; payouts?: ArchivePayouts };
    return Response.json({ tournamentId: tid, year, available: true, standings: data.standings ?? [], payouts: data.payouts ?? null, savedAt: data.savedAt ?? null });
  } catch {
    return Response.json({ tournamentId: tid, year, available: false, standings: [] });
  }
}

export async function POST(req: NextRequest) {
  let body: { tournamentId?: string; year?: number; standings?: ArchiveRow[]; payouts?: ArchivePayouts };
  try { body = await req.json(); } catch { return Response.json({ error: 'bad body' }, { status: 400 }); }

  const tid = body.tournamentId ?? '';
  const year = Number(body.year);
  const standings = Array.isArray(body.standings) ? body.standings : [];
  if (!TOURNAMENT_IDS.has(tid)) return Response.json({ error: 'unknown tournament' }, { status: 400 });
  if (isNaN(year) || year < 2000 || year > 2100) return Response.json({ error: 'bad year' }, { status: 400 });
  // Require a real, non-trivial standings payload so a partial/empty client render can't clobber a
  // good archive.
  if (standings.length < 1) return Response.json({ error: 'empty standings' }, { status: 400 });

  // Don't let a smaller payload overwrite a larger banked one (guards against a mid-load render).
  try {
    const existingRaw = await redis.get(rowKey(tid, year));
    if (existingRaw) {
      const existing = JSON.parse(existingRaw as string) as { standings?: ArchiveRow[] };
      if ((existing.standings?.length ?? 0) > standings.length) {
        return Response.json({ ok: true, skipped: 'existing archive is larger' });
      }
    }
  } catch { /* ignore, proceed to write */ }

  const clean: ArchiveRow[] = standings.slice(0, 500).map((r) => ({
    place: Number(r.place) || 0,
    name: String(r.name ?? '').slice(0, 80),
    points: Number(r.points) || 0,
    holesRemaining: Number(r.holesRemaining) || 0,
    tieBreak: Number(r.tieBreak) || 0,
    golfers: Array.isArray(r.golfers) ? r.golfers.slice(0, 12).map((g) => ({
      name: String(g?.name ?? '').slice(0, 80),
      score: String(g?.score ?? ''),
      points: Number(g?.points) || 0,
      position: String(g?.position ?? ''),
      salary: Number(g?.salary) || 0,
    })) : [],
  }));

  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const payouts: ArchivePayouts | undefined = body.payouts
    ? { first: num(body.payouts.first), second: num(body.payouts.second), third: num(body.payouts.third) }
    : undefined;

  try {
    await redis.set(rowKey(tid, year), JSON.stringify({ standings: clean, payouts, savedAt: new Date().toISOString() }));
    const years = await getYears(tid);
    if (!years.includes(year)) {
      years.push(year);
      await redis.set(yearsKey(tid), JSON.stringify(years.sort((a, b) => b - a)));
    }
  } catch {
    return Response.json({ error: 'store failed' }, { status: 500 });
  }
  return Response.json({ ok: true, count: clean.length });
}
