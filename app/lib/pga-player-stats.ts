import type { PlayerStats } from './espn-player-stats';

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

// Normalise a raw stat value string or number; returns null if meaningless
function normalizeValue(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim();
  if (!v || v === '0' || v === '0.000' || v === '0.00' || v === '0.0' || v === '-' || v === '--') return null;
  return v;
}

function withPercent(v: string): string {
  return v.endsWith('%') ? v : `${v}%`;
}

// Map PGA Tour stat IDs to PlayerStats fields
function mapStat(
  statId: string,
  rawValue: string | number | null | undefined,
  acc: Partial<PlayerStats>
): void {
  const v = normalizeValue(rawValue);
  if (v === null) return;

  switch (statId) {
    case '101': acc.drivingDistance = v; break;
    case '102': acc.drivingAccuracy = withPercent(v); break;
    case '103': acc.gir = withPercent(v); break;
    case '104': acc.puttAverage = v; break;  // putts/GIR — display layer multiplies ×18
    case '130': acc.scrambling = withPercent(v); break; // conventional scrambling — first group only (current season)
    // stat 106: total scrambling (different calc), skip
    case '111': acc.sandSaves = withPercent(v); break;
    case '108': acc.scoringAverage = v; break;
    case '02674': acc.sgTeeToGreen = v; break;
    case '02675': acc.sgTotal = v; break;   // corrected: 02675=Total, 02674=Tee-to-Green
    case '02567': acc.sgOffTee = v; break;
    case '02568': acc.sgApproach = v; break;
    case '02569': acc.sgAroundGreen = v; break;
    case '02564': acc.sgPutting = v; break;
  }
}

// playerProfileStats returns [PlayerProfileStat]; each has stats: [PlayerProfileStatItem]
// Note: 'displayValue' was removed from the schema; use 'value' (numeric) instead
type GqlStat = {
  statId?: string;
  value?: number | null;
  displayValue?: string | null; // kept for schema forward-compat, may be null/undefined
  rank?: string | number | null;
};

type GqlStatGroup = {
  stats?: GqlStat[];
};

async function gqlPost(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(PGA_GQL, {
    method: 'POST',
    headers: gqlHeaders(),
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`PGA GQL HTTP ${res.status}`);
  return res.json();
}

// Fetch a stat value from the leaderboard by rank position (no player ID needed)
export async function fetchStatLeaderboardValueByRank(statId: string, targetRank: number): Promise<string | null> {
  try {
    const query = `
      query StatLeaderboard($statId: ID!) {
        statLeaderboard(statId: $statId) {
          rows { rank displayValue }
        }
      }
    `;
    const data = await gqlPost(query, { statId }) as {
      data?: { statLeaderboard?: { rows?: Array<{ rank?: string | number; displayValue?: string | null }> } };
    };
    const rows = data?.data?.statLeaderboard?.rows;
    if (!Array.isArray(rows)) return null;
    const row = rows.find((r) => parseInt(String(r.rank ?? '')) === targetRank);
    const dv = row?.displayValue;
    return dv && dv !== '0' && dv !== '0.0' ? dv : null;
  } catch { return null; }
}

// Fetch a player's rank AND value for a specific stat from statDetails leaderboard
async function fetchStatLeaderboardEntry(statId: string, _pgaTourId: string, playerName?: string): Promise<{ rank: string | null; value: string | null }> {
  try {
    const query = `
      query StatDetails($statId: String!) {
        statDetails(tourCode: R, statId: $statId) {
          rows {
            ... on StatDetailsPlayer {
              playerId
              playerName
              rank
              stats {
                ... on CategoryPlayerStat {
                  statName
                  statValue
                }
              }
            }
          }
        }
      }
    `;
    const data = await gqlPost(query, { statId }) as {
      data?: { statDetails?: { rows?: Array<{ playerId?: string; playerName?: string; rank?: string | number; stats?: Array<{ statName?: string; statValue?: string }> }> } };
    };
    const rows = data?.data?.statDetails?.rows;
    if (!Array.isArray(rows)) return { rank: null, value: null };
    const targetName = playerName?.toLowerCase().trim();
    const row = rows.find((r) => {
      if (!r.playerName) return false;
      if (targetName) return r.playerName.toLowerCase().trim() === targetName;
      return false;
    });
    if (!row) return { rank: null, value: null };
    const rankNum = parseInt(String(row.rank ?? ''));
    const rank = !isNaN(rankNum) && rankNum > 0 ? String(rankNum) : null;
    const statVal = row.stats?.[0]?.statValue;
    const value = statVal && statVal !== '0' && statVal !== '0.0' && statVal !== '0.00' ? statVal : null;
    return { rank, value };
  } catch {
    return { rank: null, value: null };
  }
}

// Stat ID → PlayerStats field name (for rank mapping)
const STAT_ID_TO_FIELD: Record<string, string> = {
  '101': 'drivingDistance',
  '102': 'drivingAccuracy',
  '103': 'gir',
  '106': 'scrambling',
  '130': 'scrambling',
  '111': 'sandSaves',
  '108': 'scoringAverage',
  '02675': 'sgTotal',
  '02674': 'sgTeeToGreen',
  '02567': 'sgOffTee',
  '02568': 'sgApproach',
  '02569': 'sgAroundGreen',
  '02564': 'sgPutting',
};

export type PlayerStatRanks = Partial<Record<string, string>>;

export async function fetchPgaTourPlayerStats(pgaTourId: string, playerName?: string): Promise<{ stats: Partial<PlayerStats>; ranks: PlayerStatRanks } | null> {
  try {
    // playerProfileStats returns [PlayerProfileStat], each with stats: [PlayerProfileStatItem]
    // Valid fields on PlayerProfileStatItem: statId, rank, displayValue
    // 'displayValue' was removed from PlayerProfileStatItem schema — use 'value' (numeric)
    const query = `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            value
            rank
          }
        }
      }
    `;

    let stats: GqlStat[] | null = null;

    try {
      const data = await gqlPost(query, { playerId: pgaTourId }) as {
        data?: { playerProfileStats?: GqlStatGroup[] };
      };
      const groups = data?.data?.playerProfileStats;
      if (Array.isArray(groups) && groups.length > 0) {
        // Use only the first group (current season). Flattening all groups causes prior-season
        // values to overwrite current-season values for duplicate statIds (e.g. stat 130).
        const flat = groups[0].stats ?? [];
        if (flat.length > 0) stats = flat;
      }
    } catch {
      // query failed
    }

    if (!stats || stats.length === 0) return null;

    const acc: Partial<PlayerStats> = {};
    const ranks: PlayerStatRanks = {};
    // Stats whose playerProfileStats rank is unreliable — value/rank come from ESPN Core types/2
    const SKIP_PROFILE_RANK = new Set<string>();
    for (const stat of stats) {
      if (stat.statId) {
        mapStat(stat.statId, stat.value ?? stat.displayValue, acc);
        const field = STAT_ID_TO_FIELD[stat.statId];
        const rankNum = parseInt(String(stat.rank ?? ''));
        if (field && !isNaN(rankNum) && rankNum > 0 && !SKIP_PROFILE_RANK.has(field)) {
          ranks[field] = String(rankNum);
        }
      }
    }

    // For course stats with missing ranks or values, try the statLeaderboard fallback.
    // Stat 103 (GIR): playerProfileStats returns an incorrect internal metric — always
    // override with statLeaderboard which matches the official PGA Tour leaderboard.
    const COURSE_STAT_IDS = ['101', '102', '103', '108', '104', '111', '130'];
    // playerProfileStats returns incorrect internal metrics for these stats — always
    // override with statDetails which matches the official PGA Tour leaderboard.
    // 130 (scrambling) added: same issue as GIR/sand saves — internal metric doesn't match pgatour.com.
    const ALWAYS_USE_LB = new Set(['103', '111', '130']);
    const missingStatIds = COURSE_STAT_IDS.filter((id) => {
      if (ALWAYS_USE_LB.has(id)) return true;
      const field = STAT_ID_TO_FIELD[id];
      return field && (!ranks[field] || !acc[field as keyof typeof acc]);
    });

    if (missingStatIds.length > 0) {
      const fallbackEntries = await Promise.all(
        missingStatIds.map(async (id) => ({
          id,
          ...(await fetchStatLeaderboardEntry(id, pgaTourId, playerName)),
        }))
      );
      for (const { id, rank, value } of fallbackEntries) {
        const field = STAT_ID_TO_FIELD[id];
        if (!field) continue;
        if (rank && (!ranks[field] || ALWAYS_USE_LB.has(id))) ranks[field] = rank;
        if (value && (!acc[field as keyof typeof acc] || ALWAYS_USE_LB.has(id))) {
          mapStat(id, value, acc);
        }
      }
    }

    return Object.keys(acc).length > 0 ? { stats: acc, ranks } : null;
  } catch {
    return null;
  }
}
