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

type PerfItem = { statId?: string; total?: string };

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
    case '104': acc.avgPuttsPerRound = v; break;
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
): Promise<Partial<PlayerStats> | null> {
  try {
    const query = `
      query ScorecardStats($id: ID!, $playerId: ID!) {
        scorecardStatsV3(id: $id, playerId: $playerId) {
          rounds {
            round
            performance { statId total }
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
          rounds?: Array<{ round?: string; performance?: PerfItem[] }>;
        };
      };
    };

    // Use "All" round (round === "-1") for tournament totals
    const rounds = data?.data?.scorecardStatsV3?.rounds ?? [];
    const allRound = rounds.find((r) => r.round === '-1') ?? rounds[0];
    const perf = allRound?.performance ?? [];
    if (perf.length === 0) return null;

    const acc: Partial<PlayerStats> = {};
    for (const item of perf) {
      if (item.statId && item.total) {
        mapPerformanceStat(item.statId, item.total, acc);
      }
    }

    return Object.keys(acc).length > 0 ? acc : null;
  } catch {
    return null;
  }
}
