export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

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
  sgTotal: '02675',
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statKey = searchParams.get('statKey') ?? '';
  const poolTournamentId = searchParams.get('tournamentId') ?? '';

  const statId = STAT_KEY_TO_ID[statKey];
  if (!statId || !poolTournamentId) return Response.json({ entries: [] });

  const meta = TOURNAMENT_META[poolTournamentId];
  if (!meta) return Response.json({ entries: [] });

  const pgaTournId = pgaTourTournId(meta.slashGolfTournId, meta.year);

  const cacheKey = `tourn-stat-lb:v1:${pgaTournId}:${statId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ entries: JSON.parse(cached) });
  } catch { /* ignore */ }

  try {
    const query = `
      query TournStatLeaderboard($statId: ID!, $tournamentId: ID!) {
        statLeaderboard(statId: $statId, tournamentId: $tournamentId) {
          rows {
            rank
            displayValue
            player { id firstName lastName }
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
      body: JSON.stringify({ query, variables: { statId, tournamentId: pgaTournId } }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return Response.json({ entries: [] });

    const data = await res.json() as {
      data?: {
        statLeaderboard?: {
          rows?: Array<{
            rank?: number | string;
            displayValue?: string;
            player?: { id?: string; firstName?: string; lastName?: string };
          }>;
        };
      };
    };

    const rows = data?.data?.statLeaderboard?.rows ?? [];
    const entries: StatLeaderboardEntry[] = rows
      .filter((r) => r.player?.firstName || r.player?.lastName)
      .slice(0, 10)
      .map((r) => ({
        rank: parseInt(String(r.rank ?? 0)) || 0,
        name: [r.player?.firstName, r.player?.lastName].filter(Boolean).join(' '),
        value: r.displayValue ?? '',
      }))
      .filter((e) => e.name && e.value);

    if (entries.length > 0) {
      try { await redis.setex(cacheKey, 1800, JSON.stringify(entries)); } catch { /* ignore */ }
    }

    return Response.json({ entries });
  } catch {
    return Response.json({ entries: [] });
  }
}
