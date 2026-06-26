export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const GQL_HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': PGA_API_KEY,
  'Referer': 'https://www.pgatour.com/',
  'Origin': 'https://www.pgatour.com',
};

// Tournament stat IDs — scrambling uses 130 and sand saves 111 in tournament context
const STAT_KEY_TO_ID: Record<string, string> = {
  drivingDistance: '101',
  drivingAccuracy: '102',
  gir: '103',
  avgPuttsPerRound: '104',
  scrambling: '130',
  sandSaves: '111',
  scoringAverage: '108',
  sgTotal: '02675',
  sgTeeToGreen: '02675',
  sgOffTee: '02567',
  sgApproach: '02568',
  sgAroundGreen: '02569',
  sgPutting: '02564',
};

// Fetch all PGA Tour player names keyed by player ID, cached 24h (shared with season route)
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

async function fetchTournStatLeaderboardRows(
  statId: string,
  tournamentId: string,
): Promise<Array<{ pgaId: string; rank: number; displayValue: string | null }>> {
  const query = `
    query TournStatLeaderboard($statId: ID!, $tournamentId: ID!) {
      statLeaderboard(statId: $statId, tournamentId: $tournamentId) {
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
    body: JSON.stringify({ query, variables: { statId, tournamentId } }),
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  const eventId = searchParams.get('eventId') ?? '';
  if (!statKey || !eventId) return Response.json({ entries: [] });

  // Derive PGA Tour tournament ID from ESPN event ID
  const meta = getTournamentMetaByEspnId(eventId);
  if (!meta) return Response.json({ entries: [] });
  const tournId = pgaTourTournId(meta.slashGolfTournId, meta.year);

  const statId = STAT_KEY_TO_ID[statKey];
  if (!statId) return Response.json({ entries: [] });

  const cacheKey = `tourn-stat-lb:v5:${tournId}:${statKey}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const [rows, nameMap] = await Promise.all([
      fetchTournStatLeaderboardRows(statId, tournId),
      fetchPlayerNames(),
    ]);
    if (rows.length === 0) return Response.json({ entries: [] });

    const entries = rows
      .map((r) => {
        const name = nameMap.get(r.pgaId) ?? '';
        const dv = r.displayValue;
        const value = (dv && dv !== '-' && dv !== '--' && dv !== '0') ? dv : '';
        return { rank: r.rank, name, value };
      })
      .filter((e) => e.name && e.value);

    if (entries.length > 0) {
      try { await redis.setex(cacheKey, 1800, JSON.stringify(entries)); } catch { /* ignore */ }
    }
    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}
