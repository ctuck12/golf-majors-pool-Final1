export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import redis from '@/app/lib/redis';
import { tournLbCacheKey, getOrBuildPgaLeaderboard } from '@/app/lib/tournament-sg-leaderboard';
import { getTournamentMetaByEspnId } from '@/app/lib/tournament-config';
import { pgaTourTournId } from '@/app/lib/pga-scorecard-stats';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function pgaEventRows(pgaTournId: string, year: number, statId: string): Promise<string> {
  const query = `
    query TournStatLeaderboard($statId: String!, $tournamentId: String!, $year: Int!) {
      statDetails(tourCode: R, statId: $statId, year: $year, eventQuery: { tournamentId: $tournamentId, queryType: EVENT_ONLY }) {
        rows { ... on StatDetailsPlayer { playerName rank stats { ... on CategoryPlayerStat { statName statValue } } } }
      }
    }
  `;
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { statId, tournamentId: pgaTournId, year } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return `HTTP ${res.status}`;
    const data = await res.json() as { data?: { statDetails?: { rows?: Array<{ stats?: Array<{ statName?: string }> }> } }; errors?: Array<{ message?: string }> };
    if (data.errors?.length) return `gqlerr:${data.errors[0]?.message?.slice(0, 60)}`;
    const rows = data?.data?.statDetails?.rows ?? [];
    const cols = rows[0]?.stats?.map((s) => s.statName).slice(0, 6) ?? [];
    return `rows:${rows.length} cols:[${cols.join(',')}]`;
  } catch (e) { return `err:${String(e).slice(0, 80)}`; }
}

// Diagnoses why tournament-context stats fall back to season data for an event.
// Open in a browser: /api/admin/tourn-stats-debug?eventId=401811957&espnId=4682
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get('eventId') ?? '401811957';
  const espnId = searchParams.get('espnId') ?? '4682'; // Tommy Fleetwood
  const out: Record<string, unknown> = { eventId, espnId };

  // 1. Per-event leaderboard caches (what the player card reads)
  const KEYS = ['drivingDistance', 'drivingAccuracy', 'gir', 'sandSaves', 'puttAverage', 'sgTotal', 'scrambling'];
  const caches: Record<string, string> = {};
  for (const k of KEYS) {
    try {
      const raw = await redis.get(tournLbCacheKey(eventId, k));
      if (!raw) { caches[k] = 'cold'; continue; }
      const parsed = JSON.parse(raw as string) as { entries?: unknown[] };
      caches[k] = `warm(${parsed.entries?.length ?? 0})`;
    } catch (e) { caches[k] = `err:${String(e).slice(0, 40)}`; }
  }
  out.leaderboardCaches = caches;

  // 2. The app's REAL PGA builders, on demand
  try {
    const sg = await getOrBuildPgaLeaderboard(eventId, 'sgTotal');
    out.builderSgTotal = sg ? `entries:${sg.entries.length} fieldAvg:${sg.fieldAvg}` : 'null';
  } catch (e) { out.builderSgTotal = `err:${String(e).slice(0, 80)}`; }
  try {
    const scr = await getOrBuildPgaLeaderboard(eventId, 'scrambling');
    out.builderScrambling = scr ? `entries:${scr.entries.length}` : 'null';
  } catch (e) { out.builderScrambling = `err:${String(e).slice(0, 80)}`; }

  // 3. Raw PGA statDetails EVENT_ONLY probes: SG total + course stat ids
  const meta = getTournamentMetaByEspnId(eventId);
  const pgaTournId = meta ? pgaTourTournId(meta.pgaTournCode, meta.year) : null;
  out.pgaTournId = pgaTournId;
  if (pgaTournId && meta) {
    const year = parseInt(meta.year, 10);
    const probes: Record<string, string> = {};
    const PROBE_IDS: Record<string, string> = {
      sgTotal_02675: '02675',
      driveDist_101: '101',
      driveAcc_102: '102',
      gir_103: '103',
      sandSaves_111: '111',
      puttsPerGir_104: '104',
      puttingAvg_119: '119',
    };
    for (const [label, statId] of Object.entries(PROBE_IDS)) {
      probes[label] = await pgaEventRows(pgaTournId, year, statId);
    }
    out.pgaEventProbes = probes;
  }

  // 4. ESPN per-event competitor stats — try index 0 and the index list
  try {
    const res = await fetch(`${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics/0`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    out.espnStatsIdx0 = res.ok ? 'ok' : `HTTP ${res.status}`;
  } catch (e) { out.espnStatsIdx0 = `err:${String(e).slice(0, 80)}`; }
  try {
    const res = await fetch(`${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/statistics?limit=10`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      out.espnStatsList = `HTTP ${res.status}`;
    } else {
      const data = await res.json() as { count?: number; items?: Array<{ $ref?: string }> };
      out.espnStatsList = { count: data.count ?? 0, refs: (data.items ?? []).map((i) => i.$ref?.replace(/^.*statistics/, 'statistics')).slice(0, 4) };
    }
  } catch (e) { out.espnStatsList = `err:${String(e).slice(0, 80)}`; }

  return Response.json(out);
}
