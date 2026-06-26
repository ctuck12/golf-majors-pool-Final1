export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

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

export type StatLeaderboardEntry = {
  rank: number;
  name: string;
  value: string;
};

// Fetch all PGA Tour player names keyed by player ID, cached 24h
async function fetchPlayerNames(): Promise<Map<string, string>> {
  const cacheKey = 'pga:player-names:v1';
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return new Map(JSON.parse(cached) as [string, string][]);
  } catch { /* ignore */ }

  try {
    const query = `query { players { id firstName lastName } }`;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: GQL_HEADERS,
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return new Map();
    const data = await res.json() as { data?: { players?: Array<{ id: string; firstName?: string; lastName?: string }> } };
    const players = data?.data?.players ?? [];
    const map = new Map<string, string>(
      players
        .filter((p) => p.id)
        .map((p) => [String(p.id), [p.firstName, p.lastName].filter(Boolean).join(' ')])
        .filter(([, name]) => name) as [string, string][]
    );
    if (map.size > 0) {
      try { await redis.setex(cacheKey, 86400, JSON.stringify([...map])); } catch { /* ignore */ }
    }
    return map;
  } catch {
    return new Map();
  }
}

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

// Get stat value from playerProfileStats — fallback when displayValue is missing
async function fetchStatValue(pgaId: string, statId: string): Promise<string | null> {
  try {
    const query = `
      query PlayerProfileStats($playerId: ID!) {
        playerProfileStats(playerId: $playerId) {
          stats { statId value rank }
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
      data?: { playerProfileStats?: Array<{ stats?: Array<{ statId?: string; value?: number | null }> }> };
    };
    const groups = data?.data?.playerProfileStats ?? [];
    const flat = groups.flatMap((g) => g.stats ?? []);
    const stat = flat.find((s) => s.statId === statId);
    const v = stat?.value;
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

  const cacheKey = `stat-lb:v5:${statId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const [rows, nameMap] = await Promise.all([
      fetchStatLeaderboardRows(statId),
      fetchPlayerNames(),
    ]);
    if (rows.length === 0) return Response.json({ entries: [] });

    const entries: StatLeaderboardEntry[] = await Promise.all(
      rows.map(async (r) => {
        const name = nameMap.get(r.pgaId) ?? '';
        const dv = r.displayValue;
        const value = (dv && dv !== '-' && dv !== '--' && dv !== '0')
          ? dv
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
