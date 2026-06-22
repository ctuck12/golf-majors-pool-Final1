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

// Normalise a raw stat value string; returns null if meaningless
function normalizeValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v || v === '0' || v === '0.000' || v === '0.00' || v === '0.0') return null;
  return v;
}

function withPercent(v: string): string {
  return v.endsWith('%') ? v : `${v}%`;
}

// Map PGA Tour stat IDs to PlayerStats fields
function mapStat(
  statId: string,
  rawValue: string | null | undefined,
  acc: Partial<PlayerStats>
): void {
  const v = normalizeValue(rawValue);
  if (v === null) return;

  switch (statId) {
    case '101': acc.drivingDistance = v; break;
    case '102': acc.drivingAccuracy = withPercent(v); break;
    case '103': acc.gir = withPercent(v); break;
    case '104': acc.avgPuttsPerRound = v; break;
    case '106': acc.scrambling = withPercent(v); break;
    case '111': acc.birdiesPerRound = v; break;
    case '108': acc.scoringAverage = v; break;
    case '02674': acc.sgTotal = v; break;
    case '02564': acc.sgOffTee = v; break;
    case '02567': acc.sgApproach = v; break;
    case '02568': acc.sgAroundGreen = v; break;
    case '02569': acc.sgPutting = v; break;
  }
}

type GqlStat = {
  statId?: string;
  statName?: string;
  statTitle?: string;
  statValue?: string | null;
  statRank?: string | number | null;
  rank?: string | number | null;
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

export async function fetchPgaTourPlayerStats(pgaTourId: string): Promise<Partial<PlayerStats> | null> {
  try {
    // playerProfileStats returns { stats: PlayerProfileStatItem[] }
    // Confirmed: "stats" is a valid sub-field; field names on PlayerProfileStatItem TBD
    const query = `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats {
            statId
            statTitle
            statName
            statValue
            rank
          }
        }
      }
    `;

    let stats: GqlStat[] | null = null;

    try {
      const data = await gqlPost(query, { playerId: pgaTourId }) as {
        data?: { playerProfileStats?: { stats?: GqlStat[] } };
      };
      const arr = data?.data?.playerProfileStats?.stats;
      if (Array.isArray(arr) && arr.length > 0) {
        stats = arr;
      }
    } catch {
      // query failed
    }

    if (!stats || stats.length === 0) return null;

    const acc: Partial<PlayerStats> = {};
    for (const stat of stats) {
      if (stat.statId) {
        mapStat(stat.statId, stat.statValue, acc);
      }
    }

    return Object.keys(acc).length > 0 ? acc : null;
  } catch {
    return null;
  }
}
