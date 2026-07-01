export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getEspnId } from '@/app/lib/espn-player-season';

// Resolve ESPN ids + PGA orchestrator ids for Masters-legend field players by harvesting past
// Masters leaderboards (they're absent from current player directories).
const GQL = 'https://orchestrator.pgatour.com/graphql';
const KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const NAMES = ['Vijay Singh', 'Jose Maria Olazabal', 'Fred Couples', 'Angel Cabrera'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();

async function gql(query: string, variables?: Record<string, unknown>): Promise<any> {
  try {
    const res = await fetch(GQL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

async function majorCount(id: string): Promise<number | string> {
  const j = await gql(`query M($id: String!){ playerProfileMajorResults(playerId:$id){ tournaments { position } } }`, { id });
  if (j?.errors?.length) return `err`;
  return j?.data?.playerProfileMajorResults?.tournaments?.length ?? 0;
}

export async function GET() {
  // Harvest pga ids from several past Masters (tournament 014); first hit per player wins.
  const years = ['R2022014', 'R2021014', 'R2019014', 'R2018014', 'R2016014', 'R2015014'];
  const pgaId: Record<string, string> = {};
  for (const tid of years) {
    if (NAMES.every((n) => pgaId[norm(n)])) break;
    const j = await gql(`query L($id: ID!){ leaderboardV2(id:$id){ players { ... on PlayerRowV2 { player { id displayName } } } } }`, { id: tid });
    for (const p of j?.data?.leaderboardV2?.players ?? []) {
      const nm = norm(p?.player?.displayName ?? '');
      if (NAMES.map(norm).includes(nm) && !pgaId[nm]) pgaId[nm] = p?.player?.id;
    }
  }

  const out: Record<string, unknown> = {};
  for (const name of NAMES) {
    const pid = pgaId[norm(name)] ?? null;
    out[name] = {
      espnId: await getEspnId(name).catch(() => null),
      pgaTourId: pid,
      majorResults: pid ? await majorCount(pid) : 'no-id',
    };
  }
  return Response.json({ resolved: out });
}
