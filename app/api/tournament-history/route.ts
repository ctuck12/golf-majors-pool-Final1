export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import redis from '@/app/lib/redis';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';

// Historical final leaderboards for each tournament, pulled from ESPN's public golf
// scoreboard archive (site.api.espn.com). Results are final/immutable once played, so
// each (tournament, year) leaderboard is cached in Redis effectively forever.
//
// NOTE: The event is matched by NAME within the requested year's schedule, since ESPN's
// per-year event IDs are not derivable. Name matchers below cover each major + The Players.

const NAME_MATCHERS: Record<string, (n: string) => boolean> = {
  players: (n) => /players\s+championship/.test(n),
  masters: (n) => /masters/.test(n),
  pga: (n) => /pga\s+championship/.test(n),
  'us-open': (n) => /u\.?\s?s\.?\s*open/.test(n) && !/women/.test(n) && !/senior/.test(n),
  open: (n) => (/open\s+championship/.test(n) || /\bthe\s+open\b/.test(n) || /british\s+open/.test(n)) && !/u\.?\s?s\.?/.test(n) && !/women/.test(n) && !/senior/.test(n),
};

type EspnCompetitor = {
  id?: string;
  order?: number;
  athlete?: { displayName?: string; fullName?: string; flag?: { alt?: string } };
  score?: string;
  status?: { position?: { displayName?: string; id?: string }; displayValue?: string };
  statistics?: Array<{ name?: string; displayValue?: string; value?: number }>;
  linescores?: Array<{ value?: number; displayValue?: string }>;
};
type EspnEvent = {
  id?: string;
  name?: string;
  shortName?: string;
  date?: string;
  competitions?: Array<{
    venue?: { fullName?: string };
    status?: { type?: { completed?: boolean; state?: string } };
    competitors?: EspnCompetitor[];
  }>;
};

const CUT_SET = new Set(['CUT', 'WD', 'DQ', 'MDF', 'MC']);

function buildLeaderboard(ev: EspnEvent) {
  const comp = ev.competitions?.[0];
  const competitors = comp?.competitors ?? [];
  const rows = competitors
    .map((c) => {
      const name = c.athlete?.displayName ?? c.athlete?.fullName ?? '';
      const rawScore = (c.score ?? '').toUpperCase();
      const isCut = CUT_SET.has(rawScore);
      const position = c.status?.position?.displayName ?? (isCut ? rawScore : '');
      // Total strokes if ESPN provides per-round stroke values; else null.
      const totalStrokes = (c.linescores ?? []).reduce((sum, r) => sum + (typeof r.value === 'number' ? r.value : 0), 0) || null;
      const scoreStat = c.statistics?.find((s) => (s.name ?? '').toLowerCase().includes('topar'))?.displayValue;
      return {
        order: c.order ?? 9999,
        position,
        name,
        score: isCut ? rawScore : (c.score ?? scoreStat ?? ''),
        total: isCut ? null : totalStrokes,
        country: c.athlete?.flag?.alt ?? null,
        isCut,
      };
    })
    .filter((r) => r.name)
    .sort((a, b) => a.order - b.order);
  return rows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tournamentId = searchParams.get('tournamentId') ?? '';
  const yearParam = searchParams.get('year');

  const matcher = NAME_MATCHERS[tournamentId];
  const meta = TOURNAMENT_META[tournamentId];
  if (!matcher || !meta) {
    return Response.json({ error: 'unknown tournament' }, { status: 400 });
  }

  if (!yearParam) {
    return Response.json({ error: 'year required' }, { status: 400 });
  }
  const year = parseInt(yearParam, 10);
  if (isNaN(year) || year < 1990 || year > 2100) {
    return Response.json({ error: 'bad year' }, { status: 400 });
  }

  const cacheKey = `tourn-history:v1:${tournamentId}:${year}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json(JSON.parse(cached as string));
  } catch { /* ignore */ }

  try {
    // Pull the whole calendar year's PGA schedule, then find the matching event.
    const url = `https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard?dates=${year}0101-${year}1231&limit=300`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return Response.json({ tournamentId, year, leaderboard: [], available: false, error: `espn ${res.status}` });
    }
    const data = (await res.json()) as { events?: EspnEvent[] };
    const events = data.events ?? [];
    const ev = events.find((e) => {
      const n = `${e.name ?? ''} ${e.shortName ?? ''}`.toLowerCase();
      return matcher(n);
    });
    if (!ev) {
      const payload = { tournamentId, year, leaderboard: [], available: false as const };
      try { await redis.setex(cacheKey, 7 * 24 * 60 * 60, JSON.stringify(payload)); } catch { /* ignore */ }
      return Response.json(payload);
    }
    const completed = ev.competitions?.[0]?.status?.type?.completed === true;
    const leaderboard = buildLeaderboard(ev);
    const winner = leaderboard.find((r) => r.position === '1' || r.position === 'T1') ?? leaderboard[0] ?? null;
    const payload = {
      tournamentId,
      year,
      available: leaderboard.length > 0,
      completed,
      eventName: ev.name ?? null,
      venue: ev.competitions?.[0]?.venue?.fullName ?? null,
      date: ev.date ?? null,
      winner: winner ? { name: winner.name, score: winner.score } : null,
      leaderboard,
    };
    // Cache finished events forever; in-progress/empty only briefly.
    const ttl = completed && leaderboard.length > 0 ? 400 * 24 * 60 * 60 : 6 * 60 * 60;
    try { await redis.setex(cacheKey, ttl, JSON.stringify(payload)); } catch { /* ignore */ }
    return Response.json(payload);
  } catch (err) {
    return Response.json({ tournamentId, year, leaderboard: [], available: false, error: String(err) });
  }
}
