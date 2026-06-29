export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { getEspnId } from '@/app/lib/espn-player-season';
import { fetchPlayerSeasonStats } from '@/app/lib/espn-player-stats';
import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';
const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function safeJson(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { __error: `HTTP ${res.status}` };
    return await res.json();
  } catch (e) { return { __error: String(e) }; }
}

function statNames(data: unknown): unknown {
  // Extract stat name=value pairs from any ESPN core shape
  const d = data as { splits?: { categories?: Array<{ stats?: Array<{ name?: string; value?: number; displayValue?: string }> }> } | Array<{ stats?: Array<{ name?: string; value?: number; displayValue?: string }> }> };
  let stats: Array<{ name?: string; value?: number; displayValue?: string }> | undefined;
  if (d?.splits && !Array.isArray(d.splits)) stats = d.splits.categories?.[0]?.stats;
  else if (Array.isArray(d?.splits)) stats = (d.splits as Array<{ stats?: Array<{ name?: string; value?: number; displayValue?: string }> }>)[0]?.stats;
  if (!stats) return { __no_stats: true, keys: data ? Object.keys(data) : [] };
  return stats.map((s) => `${s.name}=${s.value ?? s.displayValue}`);
}

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get('name') ?? 'Stephan Jaeger';
  const pgaTourId = new URL(request.url).searchParams.get('pgaTourId') ?? '36799';
  const year = new Date().getFullYear();
  const espnId = await getEspnId(name);

  const out: Record<string, unknown> = { name, pgaTourId, espnId, year };

  // 1. Final assembled results
  out.fetchPlayerSeasonStats = await fetchPlayerSeasonStats(name).catch((e) => ({ __error: String(e) }));
  out.fetchPgaTourPlayerStats = await fetchPgaTourPlayerStats(pgaTourId, name).catch((e) => ({ __error: String(e) }));

  // 2. Raw ESPN Core endpoints
  if (espnId) {
    out.espnCore_types2 = statNames(await safeJson(`${ESPN_CORE}/seasons/${year}/types/2/athletes/${espnId}/statistics/0`));
    out.espnCore_noTypes = statNames(await safeJson(`${ESPN_CORE}/seasons/${year}/athletes/${espnId}/statistics/0`));
  }

  // 3. PGA Tour playerProfileStats GQL
  const ppQuery = `query PlayerProfileStats($playerId: ID!) { playerProfileStats(playerId: $playerId) { stats { statId value rank } } }`;
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query: ppQuery, variables: { playerId: pgaTourId } }),
      signal: AbortSignal.timeout(6000),
    });
    const j = await res.json() as { data?: { playerProfileStats?: Array<{ stats?: Array<{ statId?: string; value?: number; rank?: string }> }> }; errors?: unknown };
    out.pgaPlayerProfileStats = {
      httpOk: res.ok,
      errors: j.errors,
      groupCount: j.data?.playerProfileStats?.length,
      group0: j.data?.playerProfileStats?.[0]?.stats?.map((s) => `${s.statId}=${s.value} (rank ${s.rank})`),
    };
  } catch (e) { out.pgaPlayerProfileStats = { __error: String(e) }; }

  // 4. stat-lb redis caches — is Jaeger present?
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const target = norm(name);
  const lbKeys = ['sgTotal', 'sgTeeToGreen', 'sgOffTee', 'sgApproach', 'sgAroundGreen', 'sgPutting', 'scrambling'];
  const lbResults: Record<string, unknown> = {};
  for (const k of lbKeys) {
    try {
      const raw = await redis.get(`stat-lb:v28:${k}`);
      if (!raw) { lbResults[k] = '__cold__'; continue; }
      const parsed = JSON.parse(raw);
      const entries = parsed.entries ?? parsed;
      const idx = entries.findIndex((e: { name: string }) => norm(e.name) === target);
      lbResults[k] = idx === -1
        ? { present: false, total: entries.length, sample: entries.slice(0, 2).map((e: {name:string}) => e.name) }
        : { present: true, rank: idx + 1, value: entries[idx].value };
    } catch (e) { lbResults[k] = { __error: String(e) }; }
  }
  out.statLbCaches = lbResults;

  return Response.json(out);
}
