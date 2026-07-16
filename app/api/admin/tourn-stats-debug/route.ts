export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import redis from '@/app/lib/redis';
import { tournLbCacheKey } from '@/app/lib/tournament-sg-leaderboard';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

// Diagnoses why tournament-context stats fall back to season data for an event.
// Open in a browser: /api/admin/tourn-stats-debug?eventId=401811957&espnId=4682
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId') ?? '401811957';
  const espnId = searchParams.get('espnId') ?? '4682'; // Tommy Fleetwood
  const out: Record<string, unknown> = { eventId, espnId };

  // 1. Per-event leaderboard caches (what the player card reads)
  const KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting', 'scrambling'];
  const caches: Record<string, string> = {};
  for (const k of KEYS) {
    try {
      const raw = await redis.get(tournLbCacheKey(eventId, k));
      if (!raw) { caches[k] = 'cold'; continue; }
      const parsed = JSON.parse(raw as string) as { entries?: unknown[] };
      caches[k] = `warm(${parsed.entries?.length ?? 0} entries)`;
    } catch (e) { caches[k] = `err:${String(e).slice(0, 60)}`; }
  }
  out.leaderboardCaches = caches;

  // 2. ESPN per-event competitor stats for the sample player
  try {
    const res = await fetch(`${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics/0`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      out.espnCompetitorStats = `HTTP ${res.status}`;
    } else {
      const data = await res.json() as { splits?: { categories?: Array<{ stats?: Array<{ name: string; displayValue?: string }> }> } };
      const stats = data?.splits?.categories?.[0]?.stats ?? [];
      out.espnCompetitorStats = { count: stats.length, names: stats.map((s) => s.name).slice(0, 20) };
    }
  } catch (e) { out.espnCompetitorStats = `err:${String(e).slice(0, 120)}`; }

  // 3. ESPN competitors list (does the event expose a field at all?)
  try {
    const res = await fetch(`${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors?limit=500`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      out.espnCompetitors = `HTTP ${res.status}`;
    } else {
      const data = await res.json() as { count?: number; items?: unknown[] };
      out.espnCompetitors = { count: data.count ?? data.items?.length ?? 0 };
    }
  } catch (e) { out.espnCompetitors = `err:${String(e).slice(0, 120)}`; }

  // 4. PGA Tour statDetails EVENT_ONLY for the event (SG total sample)
  const meta = getTournamentMetaByEspnId(eventId);
  const pgaTournId = meta ? pgaTourTournId(meta.pgaTournCode, meta.year) : null;
  out.pgaTournId = pgaTournId;
  if (pgaTournId && meta) {
    try {
      const res = await fetch(PGA_GQL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY },
        body: JSON.stringify({
          query: `query StatDetails($tourCode: TourCode!, $statId: String!, $year: Int, $eventQuery: StatDetailEventQuery) { statDetails(tourCode: $tourCode, statId: $statId, year: $year, eventQuery: $eventQuery) { rows { ... on StatDetailsPlayer { playerId playerName rank } } } }`,
          variables: { tourCode: 'R', statId: '02675', year: parseInt(meta.year, 10), eventQuery: { queryType: 'EVENT_ONLY', tournamentPgaTournId: pgaTournId } },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        out.pgaStatDetails = `HTTP ${res.status}`;
      } else {
        const data = await res.json() as { data?: { statDetails?: { rows?: unknown[] } }; errors?: Array<{ message?: string }> };
        out.pgaStatDetails = { rows: data?.data?.statDetails?.rows?.length ?? 0, errors: data?.errors?.map((e) => e.message).slice(0, 2) ?? null };
      }
    } catch (e) { out.pgaStatDetails = `err:${String(e).slice(0, 120)}`; }
  }

  return Response.json(out);
}
