export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import redis from '@/app/lib/redis';
import { tournLbCacheKey, getOrBuildPgaLeaderboard } from '@/app/lib/tournament-sg-leaderboard';
import { getTournamentMetaByEspnId, TOURNAMENT_META } from '@/app/lib/tournament-config';
import { getScorecardCache, normName } from '@/app/lib/scorecard-store';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

// Diagnoses why tournament-context stats fall back / show nothing for an event+player.
// /api/admin/tourn-stats-debug?eventId=401811957&player=Cameron%20Young
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId') ?? '401811957';
  const player = searchParams.get('player') ?? 'Cameron Young';
  const out: Record<string, unknown> = { eventId, player };

  // 1. Per-event leaderboard caches (course + SG) — do they have values?
  const KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'sgTotal', 'scrambling'];
  const caches: Record<string, string> = {};
  for (const k of KEYS) {
    try {
      const raw = await redis.get(tournLbCacheKey(eventId, k));
      if (!raw) { caches[k] = 'cold'; continue; }
      const parsed = JSON.parse(raw as string) as { entries?: { name: string; value?: string }[] };
      const hit = (parsed.entries ?? []).find((e) => normName(e.name) === normName(player));
      caches[k] = `warm(${parsed.entries?.length ?? 0}) ${hit ? `HIT val=${hit.value ?? 'null'}` : 'no-hit'}`;
    } catch (e) { caches[k] = `err:${String(e).slice(0, 40)}`; }
  }
  out.leaderboardCaches = caches;

  // 2. On-demand PGA SG builder
  try {
    const sg = await getOrBuildPgaLeaderboard(eventId, 'sgTotal');
    out.builderSgTotal = sg ? `entries:${sg.entries.length}` : 'null';
  } catch (e) { out.builderSgTotal = `err:${String(e).slice(0, 60)}`; }

  // 3. Scorecard-derived path — the exact lookup the player-stats route runs
  const tournamentEntry = Object.entries(TOURNAMENT_META).find(([, m]) => m.espnEventId === eventId);
  out.tournamentId = tournamentEntry?.[0] ?? null;
  if (tournamentEntry) {
    const scCache = await getScorecardCache(tournamentEntry[0]).catch((e) => { out.scCacheError = String(e).slice(0, 80); return null; });
    if (!scCache) {
      out.scorecard = 'cache MISSING/null';
    } else {
      const players = Object.values(scCache.players);
      out.scorecardPlayerCount = players.length;
      out.scorecardSampleNames = players.slice(0, 5).map((p) => p.playerName);
      const scPlayer = players.find((p) => normName(p.playerName) === normName(player));
      if (!scPlayer) {
        out.scorecardPlayerFound = false;
        // fuzzy: any name containing the surname?
        const surname = player.split(/\s+/).pop() ?? '';
        out.scorecardFuzzyMatches = players.filter((p) => normName(p.playerName).includes(normName(surname))).map((p) => p.playerName).slice(0, 5);
      } else {
        out.scorecardPlayerFound = true;
        out.scorecardStoredName = scPlayer.playerName;
        let holes = 0; const roundDetail: string[] = [];
        for (const rnd of scPlayer.rounds ?? []) {
          const played = (rnd.holes ?? []).filter((h) => typeof h.score === 'number' && h.score > 0 && typeof h.par === 'number' && h.par > 0);
          holes += played.length;
          roundDetail.push(`R${rnd.roundId}: ${rnd.holes?.length ?? 0} holes, ${played.length} scored`);
        }
        out.scorecardRounds = roundDetail;
        out.scorecardTotalScoredHoles = holes;
        out.wouldDeriveStats = holes > 0;
      }
    }
  }

  // 4. ESPN per-event competitor stats availability (for a sample id)
  try {
    const res = await fetch(`${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    out.espnCompetitors = res.ok ? 'ok' : `HTTP ${res.status}`;
  } catch (e) { out.espnCompetitors = `err:${String(e).slice(0, 60)}`; }

  return Response.json(out);
}
