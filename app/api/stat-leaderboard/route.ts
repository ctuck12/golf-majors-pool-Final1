export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': PGA_API_KEY,
  'Referer': 'https://www.pgatour.com/',
  'Origin': 'https://www.pgatour.com',
};

const STAT_KEY_TO_ID: Record<string, string> = {
  drivingDistance: '101',
  drivingAccuracy: '102',
  gir: '103',
  avgPuttsPerRound: '104',
  scrambling: '106',
  sandSaves: '107',
  scoringAverage: '108',
  sgTotal: '02674',
  sgTeeToGreen: '02675',
  sgOffTee: '02567',
  sgApproach: '02568',
  sgAroundGreen: '02569',
  sgPutting: '02564',
};

// pgaTourId → pool name
const POOL_NAME_BY_PGA_ID: Map<string, string> = new Map(
  PLAYER_POOL_WITH_PGA_IDS
    .filter((p) => (p.pgaTourId as number) !== 99999)
    .map((p) => [String(p.pgaTourId), p.name])
);

export type StatLeaderboardEntry = {
  rank: number;
  name: string;
  value: string;
};

// Get top-10 player IDs + ranks from statLeaderboard (proven to work)
async function fetchStatLeaderboardRows(statId: string): Promise<Array<{ pgaId: string; rank: number; displayValue: string | null }>> {
  const query = `
    query StatLeaderboard($statId: ID!) {
      statLeaderboard(statId: $statId) {
        rows {
          rank
          displayValue
          player { id }
        }
      }
    }
  `;
  const res = await fetch(PGA_GQL, {
    method: 'POST',
    headers: GQL_HEADERS,
    body: JSON.stringify({ query, variables: { statId } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const data = await res.json() as {
    data?: { statLeaderboard?: { rows?: Array<{ rank?: number | string; displayValue?: string | null; player?: { id?: string } }> } };
  };
  const rows = data?.data?.statLeaderboard?.rows ?? [];
  return rows
    .filter((r) => r.player?.id)
    .slice(0, 10)
    .map((r) => ({
      pgaId: String(r.player!.id!),
      rank: parseInt(String(r.rank ?? 0)) || 0,
      displayValue: r.displayValue ?? null,
    }));
}

// Get a specific stat value for a player from playerProfileStats (same source as individual player stats)
async function fetchStatValue(pgaId: string, statId: string): Promise<string | null> {
  try {
    const query = `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats { statId value displayValue }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: GQL_HEADERS,
      body: JSON.stringify({ query, variables: { playerId: pgaId } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: { playerProfileStats?: Array<{ stats?: Array<{ statId?: string; value?: number | null; displayValue?: string | null }> }> };
    };
    const groups = data?.data?.playerProfileStats ?? [];
    const flat = groups.flatMap((g) => g.stats ?? []);
    const stat = flat.find((s) => s.statId === statId);
    if (!stat) return null;
    // Use displayValue first, fall back to numeric value
    const dv = stat.displayValue;
    if (dv && dv !== '-' && dv !== '--' && dv !== '0') return dv;
    const v = stat.value;
    if (v != null && v !== 0) return String(v);
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  const statId = STAT_KEY_TO_ID[statKey];
  if (!statId) return Response.json({ entries: [] });

  const cacheKey = `stat-lb:v3:${statId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const rows = await fetchStatLeaderboardRows(statId);
    if (rows.length === 0) return Response.json({ entries: [] });

    const entries: StatLeaderboardEntry[] = await Promise.all(
      rows.map(async (r) => {
        const name = POOL_NAME_BY_PGA_ID.get(r.pgaId) ?? '';
        // Use displayValue from leaderboard row if present, otherwise fetch from playerProfileStats
        const value = (r.displayValue && r.displayValue !== '-' && r.displayValue !== '0')
          ? r.displayValue
          : (await fetchStatValue(r.pgaId, statId)) ?? '';
        return { rank: r.rank, name, value };
      })
    );

    const valid = entries.filter((e) => e.name && e.value);
    if (valid.length > 0) {
      try { await redis.setex(cacheKey, 3600, JSON.stringify(valid)); } catch { /* ignore */ }
    }
    return Response.json({ entries: valid });
  } catch {
    return Response.json({ entries: [] });
  }
}
