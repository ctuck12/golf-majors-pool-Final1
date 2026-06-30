export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const ESPN_CORE_ATHLETES = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga/athletes';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';
const BATCH_SIZE = 25;

type Stat = { name?: string; value?: number; displayValue?: string; average?: number; averageDisplayValue?: string };

const LOWER_IS_BETTER = new Set(['scoringAverage', 'puttAverage']);

// Course stats come from ESPN per-event competitor statistics (ESPN has NO tournament SG).
const courseStatDefs: Array<{ key: string; espnName: string; isPercent?: boolean; decimals?: number }> = [
  { key: 'drivingDistance', espnName: 'driveDistAvg', isPercent: false, decimals: 1 },
  { key: 'drivingAccuracy', espnName: 'driveAccuracyPct', isPercent: true, decimals: 1 },
  { key: 'gir', espnName: 'gir', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scramblingPct', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambling', isPercent: true, decimals: 1 },
  { key: 'scrambling', espnName: 'scrambPct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSaves', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSavePct', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'sandSave', isPercent: true, decimals: 1 },
  { key: 'sandSaves', espnName: 'bunkerSavePct', isPercent: true, decimals: 1 },
  { key: 'puttAverage', espnName: 'puttsGirAvg', isPercent: false, decimals: 3 },
];

// Tournament Strokes Gained: PGA Tour statLeaderboard(statId, tournamentId). statId differs from
// season — sgTotal is 02675 (season uses 02674), tee-to-green is 02674 in tournament context.
const SG_STAT_IDS: Record<string, string> = {
  sgTotal: '02675',
  sgTeeToGreen: '02674',
  sgOffTee: '02567',
  sgApproach: '02568',
  sgAroundGreen: '02569',
  sgPutting: '02564',
};
const SG_DECIMALS = 3;

function statNumeric(stats: Stat[], name: string): number | null {
  const s = stats.find((x) => x.name === name);
  if (!s) return null;
  if (s.value != null && !isNaN(s.value) && s.value !== 0) return s.value;
  const dv = parseFloat(s.displayValue ?? '');
  if (!isNaN(dv) && dv !== 0) return dv;
  const av = parseFloat(s.averageDisplayValue ?? '');
  if (!isNaN(av) && av !== 0) return av;
  if (s.average != null && !isNaN(s.average) && s.average !== 0) return s.average;
  return null;
}

function fmtCourse(v: number, key: string): string {
  const def = courseStatDefs.find((d) => d.key === key);
  const str = v.toFixed(def?.decimals ?? 1);
  return def?.isPercent ? `${str}%` : str;
}

async function fetchCompetitorIds(eventId: string): Promise<string[]> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { items?: Array<{ id?: string; $ref?: string }> };
    return (data.items ?? []).map((item) => item.id ?? item.$ref?.match(/competitors\/(\d+)/)?.[1] ?? '').filter(Boolean);
  } catch { return []; }
}

async function fetchCompetitorStats(espnId: string, eventId: string): Promise<Stat[] | null> {
  try {
    const res = await fetch(
      `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics/0`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { splits?: { categories?: Array<{ stats?: Stat[] }> } };
    const stats = data?.splits?.categories?.[0]?.stats;
    return Array.isArray(stats) && stats.length > 0 ? stats : null;
  } catch { return null; }
}

async function fetchAthleteName(espnId: string): Promise<string> {
  try {
    const res = await fetch(`${ESPN_CORE_ATHLETES}/${espnId}?lang=en&region=us`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (!res.ok) return '';
    const data = await res.json() as { displayName?: string; fullName?: string; firstName?: string; lastName?: string };
    return data?.displayName ?? data?.fullName ?? ([data?.firstName, data?.lastName].filter(Boolean).join(' ')) ?? '';
  } catch { return ''; }
}

async function batchAll<T>(tasks: (() => Promise<T>)[], size: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    results.push(...await Promise.all(tasks.slice(i, i + size).map((t) => t())));
  }
  return results;
}

type Entry = { rank: number; name: string; value: string };

// Build the full-field tournament leaderboard for a COURSE stat from ESPN competitor stats.
async function buildCourseLeaderboard(eventId: string, statKey: string): Promise<{ entries: Entry[]; fieldAvg: string | null }> {
  const ids = await fetchCompetitorIds(eventId);
  if (ids.length === 0) return { entries: [], fieldAvg: null };
  const allStats = await batchAll(ids.map((id) => () => fetchCompetitorStats(id, eventId)), BATCH_SIZE);
  const defsForKey = courseStatDefs.filter((d) => d.key === statKey);
  const playerValues: Array<{ espnId: string; value: number }> = [];
  for (let i = 0; i < ids.length; i++) {
    const stats = allStats[i];
    if (!stats) continue;
    for (const def of defsForKey) {
      const raw = statNumeric(stats, def.espnName);
      if (raw === null) continue;
      playerValues.push({ espnId: ids[i], value: raw });
      break;
    }
  }
  if (playerValues.length === 0) return { entries: [], fieldAvg: null };
  playerValues.sort((a, b) => LOWER_IS_BETTER.has(statKey) ? a.value - b.value : b.value - a.value);
  const names = await batchAll(playerValues.map((p) => () => fetchAthleteName(p.espnId)), BATCH_SIZE);
  const entries: Entry[] = playerValues
    .map((p, i) => ({ rank: i + 1, name: names[i], value: fmtCourse(p.value, statKey) }))
    .filter((e) => e.name);
  const mean = playerValues.reduce((s, p) => s + p.value, 0) / playerValues.length;
  return { entries, fieldAvg: fmtCourse(mean, statKey) };
}

// Every SG leaderboard exposes an "Avg" column (the per-round average) — that is the value the player
// card displays for tournament SG (e.g. Smalley SG Total = 2.871, NOT the cumulative 11.482). So the
// popup shows "Avg" too and the two always match. Ranks come from the leaderboard's own rank field.
const SG_VALUE_COL = 'Avg';

function parseSgNum(raw: string | undefined): number {
  return parseFloat(String(raw ?? '').replace(/\+/g, '').replace(/,/g, '').trim());
}

// Build the full-field tournament leaderboard for an SG stat from PGA Tour statDetails (EVENT_ONLY).
// The dead statLeaderboard(statId, tournamentId) query returned FieldUndefined; statDetails with an
// eventQuery is the working path and its ranks match the scorecard ranks on the card.
async function buildSgLeaderboard(eventId: string, statKey: string): Promise<{ entries: Entry[]; fieldAvg: string | null }> {
  const statId = SG_STAT_IDS[statKey];
  if (!statId) return { entries: [], fieldAvg: null };
  const meta = getTournamentMetaByEspnId(eventId);
  if (!meta) return { entries: [], fieldAvg: null };
  const pgaTournId = pgaTourTournId(meta.slashGolfTournId, meta.year);
  const year = parseInt(meta.year, 10);

  const query = `
    query TournSgLeaderboard($statId: String!, $tournamentId: String!, $year: Int!) {
      statDetails(tourCode: R, statId: $statId, year: $year, eventQuery: { tournamentId: $tournamentId, queryType: EVENT_ONLY }) {
        rows {
          ... on StatDetailsPlayer {
            playerName
            rank
            stats { ... on CategoryPlayerStat { statName statValue } }
          }
        }
      }
    }
  `;
  type Row = { playerName?: string; rank?: number; stats?: Array<{ statName?: string; statValue?: string }> };
  let rows: Row[] = [];
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId, tournamentId: pgaTournId, year } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { entries: [], fieldAvg: null };
    const data = await res.json() as { data?: { statDetails?: { rows?: Row[] } } };
    rows = data?.data?.statDetails?.rows ?? [];
  } catch { return { entries: [], fieldAvg: null }; }
  if (rows.length === 0) return { entries: [], fieldAvg: null };

  const parsed = rows
    .map((r) => {
      const stats = Array.isArray(r.stats) ? r.stats : [];
      const value = parseSgNum(stats.find((s) => s.statName === SG_VALUE_COL)?.statValue);
      const rankNum = typeof r.rank === 'number' ? r.rank : parseInt(String(r.rank ?? '').replace(/^\s*T/i, '').trim());
      return { rank: rankNum, value, name: r.playerName ?? '' };
    })
    .filter((r) => !isNaN(r.rank) && r.rank > 0 && r.name && !isNaN(r.value));
  if (parsed.length === 0) return { entries: [], fieldAvg: null };
  parsed.sort((a, b) => a.rank - b.rank);
  const entries: Entry[] = parsed.map((r) => ({ rank: r.rank, name: r.name, value: r.value.toFixed(SG_DECIMALS) }));
  const mean = parsed.reduce((s, r) => s + r.value, 0) / parsed.length;
  const fieldAvg = !isNaN(mean) ? mean.toFixed(SG_DECIMALS) : null;
  return { entries, fieldAvg };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  const eventId = searchParams.get('eventId') ?? '';
  if (!statKey || !eventId) return Response.json({ entries: [], fieldAvg: null });

  const cacheKey = `tourn-stat-lb:v11:${eventId}:${statKey}`;
  const bust = searchParams.get('bust') === '1';
  if (!bust) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return Response.json(JSON.parse(cached));
    } catch { /* ignore */ }
  }

  try {
    const result = statKey in SG_STAT_IDS
      ? await buildSgLeaderboard(eventId, statKey)
      : await buildCourseLeaderboard(eventId, statKey);

    if (result.entries.length > 0) {
      // Completed-event data is static; cache long so the field list endpoint flakiness doesn't matter.
      try { await redis.setex(cacheKey, 604800, JSON.stringify(result)); } catch { /* ignore */ }
    }
    return Response.json(result);
  } catch {
    return Response.json({ entries: [], fieldAvg: null });
  }
}
