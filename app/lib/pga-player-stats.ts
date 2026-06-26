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
    case '106': acc.scrambling = withPercent(v); break;
    case '130': acc.scrambling = withPercent(v); break;
    case '107': acc.sandSaves = withPercent(v); break;
    case '111': acc.sandSaves = withPercent(v); break;
    case '108': acc.scoringAverage = v; break;
    case '02675': acc.sgTeeToGreen = v; break;
    case '02674': acc.sgTotal = v; break;   // SG: Tee-to-Green / Total (playerProfile)
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

// Fetch a player's rank AND value for a specific stat from the leaderboard
async function fetchStatLeaderboardEntry(statId: string, pgaTourId: string, playerName?: string): Promise<{ rank: string | null; value: string | null }> {
  try {
    const query = `
      query StatLeaderboard($statId: ID!) {
        statLeaderboard(statId: $statId) {
          rows {
            rank
            displayValue
            player { id playerId firstName lastName }
          }
        }
      }
    `;
    const data = await gqlPost(query, { statId }) as {
      data?: { statLeaderboard?: { rows?: Array<{ rank?: string | number; displayValue?: string | null; player?: { id?: string; playerId?: string; firstName?: string; lastName?: string } }> } };
    };
    const rows = data?.data?.statLeaderboard?.rows;
    if (!Array.isArray(rows)) return { rank: null, value: null };
    const targetName = playerName?.toLowerCase().trim();
    const row = rows.find((r) => {
      const p = r.player;
      if (!p) return false;
      // Match by numeric ID (strip any non-digit prefix like "R")
      const rowId = String(p.id ?? '').replace(/\D/g, '');
      const rowPid = String(p.playerId ?? '').replace(/\D/g, '');
      if (rowId === String(pgaTourId) || rowPid === String(pgaTourId)) return true;
      // Fallback: match by full name
      if (targetName && p.firstName && p.lastName) {
        return `${p.firstName} ${p.lastName}`.toLowerCase().trim() === targetName;
      }
      return false;
    });
    if (!row) return { rank: null, value: null };
    const rankNum = parseInt(String(row.rank ?? ''));
    const rank = !isNaN(rankNum) && rankNum > 0 ? String(rankNum) : null;
    const dispVal = row.displayValue;
    const value = dispVal && dispVal !== '0' && dispVal !== '0.0' && dispVal !== '0.00' ? dispVal : null;
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
  '104': 'puttAverage',
  '106': 'scrambling',
  '130': 'scrambling',
  '107': 'sandSaves',
  '108': 'scoringAverage',
  '111': 'sandSaves',
  '02675': 'sgTeeToGreen',
  '02674': 'sgTotal',
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
        const flat = groups.flatMap((g) => g.stats ?? []);
        if (flat.length > 0) stats = flat;
      }
    } catch {
      // query failed
    }

    if (!stats || stats.length === 0) return null;

    const acc: Partial<PlayerStats> = {};
    const ranks: PlayerStatRanks = {};
    for (const stat of stats) {
      if (stat.statId) {
        mapStat(stat.statId, stat.value ?? stat.displayValue, acc);
        const field = STAT_ID_TO_FIELD[stat.statId];
        const rankNum = parseInt(String(stat.rank ?? ''));
        if (field && !isNaN(rankNum) && rankNum > 0) {
          ranks[field] = String(rankNum);
        }
      }
    }

    // For course stats with missing ranks or values, try the statLeaderboard fallback.
    // Stat 103 (GIR): playerProfileStats returns an incorrect internal metric — always
    // override with statLeaderboard which matches the official PGA Tour leaderboard.
    const COURSE_STAT_IDS = ['101', '102', '103', '106', '107', '130', '111', '108', '104'];
    const ALWAYS_USE_LB = new Set(['103']);
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

    // Extra fallback: try playerProfileStats with displayValue for sand saves (stat 107)
    // in case statLeaderboard returned no value
    if (!acc.sandSaves) {
      try {
        const dvQuery = `
          query PlayerProfileStatsV2($playerId: ID!) {
            playerProfileStats(playerId: $playerId) {
              stats {
                statId
                displayValue
                rank
              }
            }
          }
        `;
        const dvData = await gqlPost(dvQuery, { playerId: pgaTourId }) as {
          data?: { playerProfileStats?: GqlStatGroup[] };
        };
        const dvGroups = dvData?.data?.playerProfileStats;
        if (Array.isArray(dvGroups)) {
          const flat = dvGroups.flatMap((g) => g.stats ?? []);
          const sandSavesStat = flat.find((s) => s.statId === '107');
          if (sandSavesStat?.displayValue) {
            mapStat('107', sandSavesStat.displayValue, acc);
            const rankNum = parseInt(String(sandSavesStat.rank ?? ''));
            if (!isNaN(rankNum) && rankNum > 0 && !ranks.sandSaves) {
              ranks.sandSaves = String(rankNum);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return Object.keys(acc).length > 0 ? { stats: acc, ranks } : null;
  } catch {
    return null;
  }
}
