import redis from '@/app/lib/redis';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

// Tournament Strokes Gained statIds. sgTotal is 02675 in tournament context (season uses 02674).
export const SG_STAT_IDS: Record<string, string> = {
  sgTotal: '02675',
  sgTeeToGreen: '02674',
  sgOffTee: '02567',
  sgApproach: '02568',
  sgAroundGreen: '02569',
  sgPutting: '02564',
};

// Every SG leaderboard exposes an "Avg" column (the per-round average) — that is the value the player
// card displays for tournament SG (e.g. Smalley SG Total = 2.871, NOT the cumulative total). The popup
// shows "Avg" too so the two always match. Ranks come from the leaderboard's own rank field.
const SG_VALUE_COL = 'Avg';
const SG_DECIMALS = 3;

export type TournLbEntry = { rank: number; name: string; value: string };
export type TournLbResult = { entries: TournLbEntry[]; fieldAvg: string | null };

export function tournLbCacheKey(eventId: string, statKey: string): string {
  return `tourn-stat-lb:v11:${eventId}:${statKey}`;
}

function parseSgNum(raw: string | undefined): number {
  return parseFloat(String(raw ?? '').replace(/\+/g, '').replace(/,/g, '').trim());
}

// Build the full-field tournament leaderboard for an SG stat from PGA Tour statDetails (EVENT_ONLY).
// One cheap GraphQL call returns the whole ranked field, so this is safe to run on demand.
export async function buildSgLeaderboard(eventId: string, statKey: string): Promise<TournLbResult> {
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
  const entries: TournLbEntry[] = parsed.map((r) => ({ rank: r.rank, name: r.name, value: r.value.toFixed(SG_DECIMALS) }));
  const mean = parsed.reduce((s, r) => s + r.value, 0) / parsed.length;
  const fieldAvg = !isNaN(mean) ? mean.toFixed(SG_DECIMALS) : null;
  return { entries, fieldAvg };
}

// Read the SG leaderboard from cache; if cold, build it (one GraphQL call) and cache it. This keeps the
// player card's tournament SG rank+value identical to the popup even when the warming cron hasn't run.
export async function getOrBuildSgLeaderboard(eventId: string, statKey: string): Promise<TournLbResult | null> {
  const cacheKey = tournLbCacheKey(eventId, statKey);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached as string);
  } catch { /* fall through to build */ }
  const result = await buildSgLeaderboard(eventId, statKey);
  if (result.entries.length > 0) {
    try { await redis.setex(cacheKey, 604800, JSON.stringify(result)); } catch { /* ignore */ }
    return result;
  }
  return null;
}
