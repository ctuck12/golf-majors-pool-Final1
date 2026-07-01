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

// Run async tasks with bounded concurrency (keeps the total ESPN fetch fan-out in check).
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

// Scan a fixed span of seasons rather than the statisticslog's season list — the statisticslog
// only covers seasons where the player was a European Tour member, so it misses PGA-era seasons
// that still carry co-sanctioned DP World Tour events (e.g. the U.S. Open). 2000..now covers any
// active pool player's career; empty seasons return fast.
function seasonRange(): number[] {
  const now = new Date().getUTCFullYear();
  const out: number[] = [];
  for (let y = now + 1; y >= 2000; y--) out.push(y);
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name') ?? '';
  let espnId = url.searchParams.get('espnId') ?? '';
  if (!espnId && name) espnId = (await getEspnId(name).catch(() => null)) ?? '';
  if (!espnId) return Response.json({ wins: 0, winsList: [] as DpwWin[] });

  const cacheKey = `dpworld-wins:v3:${espnId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json(JSON.parse(cached as string));
  } catch { /* ignore */ }

  // Scan seasons SEQUENTIALLY (fetching all season eventlogs at once throttles ESPN and drops
  // recent high-volume seasons). Within each season, check the played events' finishing positions
  // concurrently. Position "1" = a win. De-dup event ids across seasons.
  const winEventIds = new Set<string>();
  const seenEvents = new Set<string>();
  for (const season of seasonRange()) {
    const elog = await jf(`${EUR}/seasons/${season}/athletes/${espnId}/eventlog`, 7000) as {
      events?: { items?: Array<{ played?: boolean; event?: Record<string, string> }> };
    } | null;
    const ids: string[] = [];
    for (const it of elog?.events?.items ?? []) {
      if (!it.played) continue;
      const ref = Object.values(it.event ?? {})[0] ?? '';
      const eventId = String(ref).match(/events\/(\d+)/)?.[1];
      if (eventId && !seenEvents.has(eventId)) { seenEvents.add(eventId); ids.push(eventId); }
    }
    if (ids.length === 0) continue;
    await mapLimit(ids, 12, async (eventId) => {
      const status = await jf(`${EUR}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/status`, 5000) as {
        position?: { displayName?: string };
      } | null;
      if (status?.position?.displayName === '1') winEventIds.add(eventId);
    });
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
