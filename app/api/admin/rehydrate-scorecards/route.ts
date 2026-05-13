export const dynamic = 'force-dynamic';

import { PLAYER_POOL_WITH_PGA_IDS } from '@/app/lib/player-pool';
import { fetchScorecard, parseMongo } from '@/app/lib/slashgolf';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import {
  readLeaderboardCache,
  getScorecardCache,
  mergeScorecardCache,
  normName,
  type StoredPlayerScorecards,
} from '@/app/lib/scorecard-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'masters';

  const meta = TOURNAMENT_META[tournamentId];
  if (!meta) return Response.json({ error: 'Unknown tournament' }, { status: 400 });

  const lbCache = await readLeaderboardCache(tournamentId);
  if (!lbCache || lbCache.notStarted) {
    return Response.json({ error: 'No leaderboard data available' }, { status: 400 });
  }

  const scorecardCache = await getScorecardCache(tournamentId);

  const rowByName = new Map(
    lbCache.leaderboard.map((r) => [normName(`${r.firstName} ${r.lastName}`), r]),
  );

  const updatedPlayers: Record<string, StoredPlayerScorecards> = {};
  const results: Record<string, string> = {};

  for (const poolPlayer of PLAYER_POOL_WITH_PGA_IDS) {
    const row = rowByName.get(normName(poolPlayer.name));
    if (!row?.playerId) {
      results[poolPlayer.name] = 'not-in-field';
      continue;
    }

    const existing = scorecardCache?.players[row.playerId];
    if (existing?.rounds && existing.rounds.length > 0) {
      results[poolPlayer.name] = `already-cached (${existing.rounds.length} rounds)`;
      continue;
    }

    try {
      const roundsRaw = await fetchScorecard(meta.slashGolfTournId, meta.year, row.playerId);
      const stored = roundsRaw
        .map((r) => ({
          roundId: parseMongo(r.roundId),
          holes: Object.entries(r.holes ?? {})
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([, h]) => ({
              holeNumber: parseMongo(h.holeId),
              par: parseMongo(h.par),
              score: parseMongo(h.holeScore),
            }))
            .filter((h) => h.par > 0 && h.score > 0),
        }))
        .filter((r) => r.holes.length > 0);

      if (stored.length > 0) {
        updatedPlayers[row.playerId] = {
          playerId: row.playerId,
          playerName: poolPlayer.name,
          rounds: stored,
          refreshedAt: new Date().toISOString(),
        };
        results[poolPlayer.name] = `fetched (${stored.length} rounds)`;
      } else {
        results[poolPlayer.name] = 'no-hole-data';
      }
    } catch (err) {
      results[poolPlayer.name] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (Object.keys(updatedPlayers).length > 0) {
    await mergeScorecardCache(tournamentId, updatedPlayers);
  }

  return Response.json({
    tournamentId,
    updatedCount: Object.keys(updatedPlayers).length,
    results,
  });
}
