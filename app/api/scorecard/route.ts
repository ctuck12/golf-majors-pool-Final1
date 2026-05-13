export const dynamic = 'force-dynamic';

import { fetchScorecard, parseMongo } from '@/app/lib/slashgolf';
import { TOURNAMENT_META } from '@/app/lib/tournament-config';
import { getScorecardCache, readLeaderboardCache, normName } from '@/app/lib/scorecard-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'pga';
  const playerName = searchParams.get('playerName') ?? '';

  const meta = TOURNAMENT_META[tournamentId];
  if (!meta) return Response.json({ error: 'Unknown tournament' }, { status: 400 });

  // ── 1. Look up the player's Slash Golf playerId from the leaderboard cache ─
  let playerId: string | null = null;

  const lbCache = await readLeaderboardCache(tournamentId);
  if (lbCache && !lbCache.notStarted) {
    const match = lbCache.leaderboard.find(
      (r) => normName(`${r.firstName} ${r.lastName}`) === normName(playerName),
    );
    if (match?.playerId) playerId = String(match.playerId);
  }

  // ── 2. Live fetch — skipped for completed tournaments (data is in Redis cache) ─
  if (playerId && !lbCache?.tournamentComplete) {
    try {
      const roundsRaw = await fetchScorecard(meta.slashGolfTournId, meta.year, playerId);
      const rounds = roundsRaw.map((r) => ({
        round: parseMongo(r.roundId),
        score: r.currentRoundScore ?? null,
        holes: Object.entries(r.holes ?? {})
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, h]) => ({
            hole: parseMongo(h.holeId),
            par: parseMongo(h.par),
            score: parseMongo(h.holeScore),
            label: String(parseMongo(h.holeScore)),
          })),
      }));
      return Response.json({
        courseName: meta.courseName,
        par: meta.par,
        rounds,
        source: 'slash-golf-live',
      });
    } catch {
      // Fall through to cache fallback
    }
  }

  // ── 3. Fall back to scorecard cache (completed rounds only) ───────────────
  const cache = await getScorecardCache(tournamentId);
  if (cache) {
    const stored = Object.values(cache.players).find(
      (p) => normName(p.playerName) === normName(playerName),
    );
    if (stored?.rounds.length) {
      return Response.json({
        courseName: meta.courseName,
        par: meta.par,
        rounds: stored.rounds.map((r) => {
          const toPar = r.holes.reduce((sum, h) => sum + h.score - h.par, 0);
          const score = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : String(toPar);
          return {
            round: r.roundId,
            score,
            holes: r.holes.map((h) => ({
              hole: h.holeNumber,
              par: h.par,
              score: h.score,
              label: String(h.score),
            })),
          };
        }),
        source: 'slash-golf-cache',
      });
    }
  }

  return Response.json({
    courseName: meta.courseName,
    par: meta.par,
    rounds: [],
    source: 'unavailable',
    message: playerId ? 'Scorecard fetch failed' : 'Player not found in tournament field',
  });
}
