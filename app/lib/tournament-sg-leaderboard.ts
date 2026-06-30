import redis from '@/app/lib/redis';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const sgFmt = (n: number) => n.toFixed(3);
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

// Tournament stats sourced from the PGA Tour `statDetails` feed (EVENT_ONLY) rather than ESPN. The SG
// stats live only here; scrambling is here too because ESPN's per-event stats carry no scrambling
// field. Each entry maps a card stat key to its PGA statId, the value column to read, and how to format
// it. SG uses the per-round "Avg" column (matches the card); scrambling uses the "%" column.
type PgaStatCfg = { statId: string; column: string; fmt: (n: number) => string };
const PGA_STATS: Record<string, PgaStatCfg> = {
  sgTotal: { statId: '02675', column: 'Avg', fmt: sgFmt },
  sgTeeToGreen: { statId: '02674', column: 'Avg', fmt: sgFmt },
  sgOffTee: { statId: '02567', column: 'Avg', fmt: sgFmt },
  sgApproach: { statId: '02568', column: 'Avg', fmt: sgFmt },
  sgAroundGreen: { statId: '02569', column: 'Avg', fmt: sgFmt },
  sgPutting: { statId: '02564', column: 'Avg', fmt: sgFmt },
  scrambling: { statId: '130', column: '%', fmt: pctFmt },
};

// Card stat keys served from the PGA feed (so callers can route these here instead of ESPN).
export const PGA_STAT_KEYS = new Set(Object.keys(PGA_STATS));
export function isPgaStatKey(statKey: string): boolean {
  return PGA_STATS[statKey] !== undefined;
}

export type TournLbEntry = { rank: number; name: string; value: string };
export type TournLbResult = { entries: TournLbEntry[]; fieldAvg: string | null };

export function tournLbCacheKey(eventId: string, statKey: string): string {
  return `tourn-stat-lb:v12:${eventId}:${statKey}`;
}

// Cache TTL for a tournament leaderboard. Completed (or not-yet-started) events are static, so cache
// long (7 days). While an event is LIVE its stats change every round, so cache briefly (~10 min) and
// let the cron keep it fresh — otherwise the first warm of round 1 would freeze the card all weekend.
// Live window: from ~1 day before lock through ~5 days after (covers Thu–Sun play + Monday finalize).
export function tournLbTtl(eventId: string): number {
  const meta = getTournamentMetaByEspnId(eventId);
  if (!meta?.lockAtUtc) return 604800;
  const lock = Date.parse(meta.lockAtUtc);
  if (isNaN(lock)) return 604800;
  const now = Date.now();
  const dayMs = 86400000;
  if (now >= lock - dayMs && now <= lock + 5 * dayMs) return 600; // live → refresh every ~10 min
  return 604800; // static (completed or future) → long cache
}

function parseNum(raw: string | undefined): number {
  // Handles "+1.234", "1,234", "50.00%" — parseFloat stops at the % sign.
  return parseFloat(String(raw ?? '').replace(/\+/g, '').replace(/,/g, '').trim());
}

// Build the full-field tournament leaderboard for a PGA-sourced stat (SG or scrambling) from the PGA
// Tour `statDetails` feed (EVENT_ONLY). One cheap GraphQL call returns the whole ranked field, so this
// is safe to run on demand.
export async function buildPgaLeaderboard(eventId: string, statKey: string): Promise<TournLbResult> {
  const cfg = PGA_STATS[statKey];
  if (!cfg) return { entries: [], fieldAvg: null };
  const meta = getTournamentMetaByEspnId(eventId);
  if (!meta) return { entries: [], fieldAvg: null };
  const pgaTournId = pgaTourTournId(meta.slashGolfTournId, meta.year);
  const year = parseInt(meta.year, 10);

  const query = `
    query TournStatLeaderboard($statId: String!, $tournamentId: String!, $year: Int!) {
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
      body: JSON.stringify({ query, variables: { statId: cfg.statId, tournamentId: pgaTournId, year } }),
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
      const value = parseNum(stats.find((s) => s.statName === cfg.column)?.statValue);
      const rankNum = typeof r.rank === 'number' ? r.rank : parseInt(String(r.rank ?? '').replace(/^\s*T/i, '').trim());
      return { rank: rankNum, value, name: r.playerName ?? '' };
    })
    .filter((r) => !isNaN(r.rank) && r.rank > 0 && r.name && !isNaN(r.value));
  if (parsed.length === 0) return { entries: [], fieldAvg: null };
  parsed.sort((a, b) => a.rank - b.rank);
  const entries: TournLbEntry[] = parsed.map((r) => ({ rank: r.rank, name: r.name, value: cfg.fmt(r.value) }));
  const mean = parsed.reduce((s, r) => s + r.value, 0) / parsed.length;
  const fieldAvg = !isNaN(mean) ? cfg.fmt(mean) : null;
  return { entries, fieldAvg };
}

// Read the PGA leaderboard from cache; if cold, build it (one GraphQL call) and cache it. This keeps the
// player card's tournament rank+value identical to the popup even when the warming cron hasn't run.
export async function getOrBuildPgaLeaderboard(eventId: string, statKey: string): Promise<TournLbResult | null> {
  const cacheKey = tournLbCacheKey(eventId, statKey);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached as string);
  } catch { /* fall through to build */ }
  const result = await buildPgaLeaderboard(eventId, statKey);
  if (result.entries.length > 0) {
    try { await redis.setex(cacheKey, tournLbTtl(eventId), JSON.stringify(result)); } catch { /* ignore */ }
    return result;
  }
  return null;
}
