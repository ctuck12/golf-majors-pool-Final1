export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

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

// pgaTourId → name lookup from pool
const POOL_NAME_BY_PGA_ID: Map<string, string> = new Map(
  PLAYER_POOL_WITH_PGA_IDS
    .filter((p) => p.pgaTourId && (p.pgaTourId as number) !== 99999)
    .map((p) => [String(p.pgaTourId), p.name])
);

export type StatLeaderboardEntry = {
  rank: number;
  name: string;
  value: string;
};

async function fetchPlayerDisplayName(pgaTourId: string): Promise<string | null> {
  try {
    const query = `
      query PlayerName($id: ID!) {
        playerProfile(playerId: $id) {
          player { displayName }
        }
      }
    `;
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/',
        'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables: { id: pgaTourId } }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { playerProfile?: { player?: { displayName?: string } } } };
    return data?.data?.playerProfile?.player?.displayName ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  const statId = STAT_KEY_TO_ID[statKey];
  if (!statId) return Response.json({ entries: [] });

  const cacheKey = `stat-lb:v2:${statId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore cache errors */ }

  try {
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
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PGA_API_KEY,
        'Referer': 'https://www.pgatour.com/',
        'Origin': 'https://www.pgatour.com',
      },
      body: JSON.stringify({ query, variables: { statId } }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return Response.json({ entries: [] });

    const data = await res.json() as {
      data?: {
        statLeaderboard?: {
          rows?: Array<{
            rank?: number | string;
            displayValue?: string;
            player?: { id?: string };
          }>;
        };
      };
    };

    const rows = (data?.data?.statLeaderboard?.rows ?? [])
      .filter((r) => r.player?.id && r.displayValue && r.displayValue !== '0' && r.displayValue !== '--')
      .slice(0, 10);

    const entries: StatLeaderboardEntry[] = await Promise.all(
      rows.map(async (r) => {
        const pgaId = String(r.player!.id!);
        const name = POOL_NAME_BY_PGA_ID.get(pgaId) ?? (await fetchPlayerDisplayName(pgaId)) ?? '';
        return {
          rank: parseInt(String(r.rank ?? 0)) || 0,
          name,
          value: r.displayValue ?? '',
        };
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
