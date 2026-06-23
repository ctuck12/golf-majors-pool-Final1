import type { PlayerStats } from './espn-player-stats';
import type { PlayerStatRanks } from './pga-player-stats';

// Stat IDs for Off Tee/Approach/Around/Putting are identical in season & tournament
// contexts and carry tournament ranks inside scorecardStatsV3 performance items.
const SG_PERF_RANK_IDS: Record<string, string> = {
  '02675': 'sgTotal',
  '02567': 'sgOffTee',
  '02568': 'sgApproach',
  '02569': 'sgAroundGreen',
  '02564': 'sgPutting',
};

// sgTotal uses 02674 (season) or 02675 (tournament) in strokesGained only.
// 02674 in performance carries the season rank — never read it from there.
const SG_STAT_ID_TO_FIELD: Record<string, string> = {
  '02674': 'sgTotal',
  '02675': 'sgTotal',
  '02567': 'sgOffTee',
  '02568': 'sgApproach',
  '02569': 'sgAroundGreen',
  '02564': 'sgPutting',
};

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function gqlHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

// "69.64% (39/56)" → "69.64%"   "331.40 yds" → "331.4"   "3.739" → "3.739"
function parseStatValue(raw: string): string | null {
  if (!raw || raw === '-' || raw === '--') return null;
  const pctMatch = raw.match(/^(-?[\d.]+%)/);
  if (pctMatch) return pctMatch[1];
  const ydsMatch = raw.match(/^([\d.]+)\s*yds/i);
  if (ydsMatch) return ydsMatch[1];
  if (!isNaN(parseFloat(raw))) return raw.trim();
  return null;
}

type PerfItem = { statId?: string; total?: string; rank?: string | number | null };

function mapPerformanceStat(statId: string, raw: string, acc: Partial<PlayerStats>): void {
  const v = parseStatValue(raw);
  if (!v) return;
  switch (statId) {
    case '02675': acc.sgTotal = v; break;
    case '02567': acc.sgOffTee = v; break;
    case '02568': acc.sgApproach = v; break;
    case '02569': acc.sgAroundGreen = v; break;
    case '02564': acc.sgPutting = v; break;
    case '101': acc.drivingDistance = v; break;
    case '102': acc.drivingAccuracy = v; break;
    case '103': acc.gir = v; break;
    case '104': acc.puttAverage = v; break; // putts/GIR from scorecard — display layer multiplies ×18
    case '130': acc.scrambling = v; break;
  }
}

// Derive PGA Tour tournament ID from slashGolf ID + year (e.g. "R2026033")
export function pgaTourTournId(slashGolfTournId: string, year: string): string {
  return `R${year}${slashGolfTournId.padStart(3, '0')}`;
}

export async function fetchPgaScorecardStats(
  pgaTournId: string,
  pgaPlayerId: string,
): Promise<{ stats: Partial<PlayerStats>; sgRanks: PlayerStatRanks } | null> {
  try {
    const query = `
      query ScorecardStats($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          rounds {
            round
            performance { statId total rank }
            strokesGained { statId total rank }
          }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: gqlHeaders(),
      body: JSON.stringify({ query, variables: { id: pgaTournId, playerId: pgaPlayerId } }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: {
        scorecardStatsV3?: {
          rounds?: Array<{ round?: string; performance?: PerfItem[]; strokesGained?: PerfItem[] }>;
        };
      };
    };

    // Use "All" round (round === "-1") for tournament totals; fall back to last round
    const rounds = data?.data?.scorecardStatsV3?.rounds ?? [];
    const allRound = rounds.find((r) => r.round === '-1') ?? rounds[rounds.length - 1];
    const perf = allRound?.performance ?? [];
    const sg = allRound?.strokesGained ?? [];
    if (perf.length === 0 && sg.length === 0) return null;

    const acc: Partial<PlayerStats> = {};
    for (const item of perf) {
      if (item.statId && item.total) {
        mapPerformanceStat(item.statId, item.total, acc);
      }
    }

    // Extract tournament SG ranks — check performance items, strokesGained items,
    // and fall back to searching all rounds if the aggregate round lacks rank data
    // Extract tournament SG ranks ONLY from strokesGained items — never from performance,
    // which carries season ranks that would contaminate tournament view
    const sgRanks: PlayerStatRanks = {};

    // Off Tee / Approach / Around Green / Putting: same stat IDs in both contexts;
    // performance items carry tournament-specific ranks for these.
    for (const item of perf) {
      if (!item.statId) continue;
      const field = SG_PERF_RANK_IDS[item.statId];
      if (!field || sgRanks[field]) continue;
      // Strip leading "T" (tied) prefix before parsing — e.g. "T14" → 14, " 7" → 7
      const rankNum = parseInt(String(item.rank ?? '').replace(/^\s*T/i, '').trim());
      if (!isNaN(rankNum) && rankNum > 0) sgRanks[field] = String(rankNum);
    }

    // SG Total: 02674/02675 in performance carries season rank — only trust strokesGained
    const extractTotalFromSg = (items: PerfItem[]) => {
      for (const item of items) {
        if (!item.statId || sgRanks['sgTotal']) continue;
        const field = SG_STAT_ID_TO_FIELD[item.statId];
        if (field !== 'sgTotal') continue;
        const rankNum = parseInt(String(item.rank ?? ''));
        if (!isNaN(rankNum) && rankNum > 0) sgRanks['sgTotal'] = String(rankNum);
      }
    };

    extractTotalFromSg(sg);
    // Fallback: search individual rounds' strokesGained for sgTotal rank
    if (!sgRanks['sgTotal']) {
      for (const round of rounds) {
        if (round.round === '-1') continue;
        extractTotalFromSg(round.strokesGained ?? []);
      }
    }

    return Object.keys(acc).length > 0 || Object.keys(sgRanks).length > 0
      ? { stats: acc, sgRanks }
      : null;
  } catch {
    return null;
  }
}

// SG stat IDs used in tournament context → PlayerStats field names
const TOURN_SG_STATS: Array<{ statId: string; field: string }> = [
  { statId: '02675', field: 'sgTotal' },     // tournament SG total (differs from season 02674)
  { statId: '02567', field: 'sgOffTee' },
  { statId: '02568', field: 'sgApproach' },
  { statId: '02569', field: 'sgAroundGreen' },
  { statId: '02564', field: 'sgPutting' },
];

// Fetch tournament-specific SG rankings from PGA Tour statLeaderboard
export async function fetchTournamentSgRanks(
  pgaTournId: string,
  pgaPlayerId: string,
): Promise<PlayerStatRanks> {
  const ranks: PlayerStatRanks = {};
  const query = `
    query TournStatLeaderboard($statId: ID!, $tournamentId: ID!) {
      statLeaderboard(statId: $statId, tournamentId: $tournamentId) {
        rows {
          rank
          player { id }
        }
      }
    }
  `;

  await Promise.all(
    TOURN_SG_STATS.map(async ({ statId, field }) => {
      try {
        const res = await fetch(PGA_GQL, {
          method: 'POST',
          headers: gqlHeaders(),
          body: JSON.stringify({ query, variables: { statId, tournamentId: pgaTournId } }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return;
        const data = await res.json() as {
          data?: { statLeaderboard?: { rows?: Array<{ rank?: string | number; player?: { id?: string } }> } };
        };
        const rows = data?.data?.statLeaderboard?.rows;
        if (!Array.isArray(rows)) return;
        const row = rows.find((r) => String(r.player?.id) === String(pgaPlayerId));
        if (!row) return;
        const rankNum = parseInt(String(row.rank ?? ''));
        if (!isNaN(rankNum) && rankNum > 0) ranks[field] = String(rankNum);
      } catch {
        // ignore per-stat failures
      }
    })
  );

  return ranks;
}
