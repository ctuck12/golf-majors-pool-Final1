export const dynamic = 'force-dynamic';
export const maxDuration = 60; // scans every DP World Tour event the player has played

import redis from '@/app/lib/redis';
import { getEspnId } from '@/app/lib/espn-player-season';

// ESPN's DP World Tour (European Tour) league code is "eur"; the same ESPN athlete id works here.
const EUR = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/eur';

export type DpwWin = { tournament: string; year: string; course: string | null; toPar: string | null };

async function jf(url: string, ms = 5000): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return await r.json() as Record<string, unknown>;
  } catch { return null; }
}

function fmtToPar(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s) return null;
  if (/^(e|even)$/i.test(s)) return 'E';
  const n = parseInt(s.replace(/[^\d.+-]/g, ''), 10);
  if (isNaN(n)) return null;
  if (n === 0) return 'E';
  return n > 0 ? `+${n}` : `${n}`;
}

// The seasons a player has a DP World Tour record, read from their eur statisticslog
// (the entries list the seasons even though it carries no usable win stat).
async function seasonsForAthlete(espnId: string): Promise<number[]> {
  const log = await jf(`${EUR}/athletes/${espnId}/statisticslog`, 6000) as { entries?: Array<{ season?: { $ref?: string } }> } | null;
  const years = new Set<number>();
  for (const e of log?.entries ?? []) {
    const y = String(e?.season?.$ref ?? '').match(/seasons\/(\d{4})/)?.[1];
    if (y) years.add(parseInt(y, 10));
  }
  if (years.size > 0) return [...years].sort((a, b) => b - a);
  // Fallback: scan a broad recent range if the statisticslog gave us nothing.
  const now = new Date().getFullYear();
  const out: number[] = [];
  for (let y = now; y >= now - 20; y--) out.push(y);
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  let espnId = url.searchParams.get('espnId') ?? '';
  if (!espnId && name) espnId = (await getEspnId(name).catch(() => null)) ?? '';
  if (!espnId) return Response.json({ wins: 0, winsList: [] as DpwWin[] });

  const cacheKey = `dpworld-wins:v1:${espnId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json(JSON.parse(cached as string));
  } catch { /* ignore */ }

  const seasons = await seasonsForAthlete(espnId);

  // Collect winning event ids (position "1"), de-duplicated across season logs.
  const winEventIds = new Set<string>();
  for (const season of seasons) {
    const elog = await jf(`${EUR}/seasons/${season}/athletes/${espnId}/eventlog`, 6000) as {
      events?: { items?: Array<{ played?: boolean; event?: Record<string, string> }> };
    } | null;
    const played = (elog?.events?.items ?? []).filter((i) => i.played);
    await Promise.all(played.map(async (it) => {
      const ref = Object.values(it.event ?? {})[0] ?? '';
      const eventId = String(ref).match(/events\/(\d+)/)?.[1];
      if (!eventId) return;
      const status = await jf(`${EUR}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/status`, 4000) as {
        position?: { displayName?: string };
      } | null;
      if (status?.position?.displayName === '1') winEventIds.add(eventId);
    }));
  }

  // For each win, resolve the tournament name, year, course and winning score to par.
  const winsList: DpwWin[] = (await Promise.all([...winEventIds].map(async (eventId) => {
    const [ev, score] = await Promise.all([
      jf(`${EUR}/events/${eventId}`, 5000) as Promise<{ name?: string; date?: string; courses?: Array<{ name?: string }> } | null>,
      jf(`${EUR}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/score`, 4000) as Promise<{ displayValue?: string; value?: number } | null>,
    ]);
    const year = ev?.date ? String(new Date(ev.date).getUTCFullYear()) : '';
    return {
      tournament: String(ev?.name ?? '').trim(),
      year,
      course: (ev?.courses?.[0]?.name ?? '').trim() || null,
      toPar: fmtToPar(score?.displayValue ?? score?.value),
    } as DpwWin;
  }))).filter((w) => w.tournament || w.year);

  winsList.sort((a, b) => Number(b.year) - Number(a.year));
  const payload = { wins: winsList.length, winsList };

  try { await redis.setex(cacheKey, 604800, JSON.stringify(payload)); } catch { /* ignore */ } // 7 days
  return Response.json(payload);
}
