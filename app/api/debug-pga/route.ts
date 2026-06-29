export const dynamic = 'force-dynamic';

import { fetchPgaTourPlayerStats } from '@/app/lib/pga-player-stats';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('pgaTourId') ?? '46970';
  const name = new URL(request.url).searchParams.get('name') ?? 'Jon Rahm';

  const result = await fetchPgaTourPlayerStats(id, name).catch((e) => ({ __error: String(e) }));

  // Raw playerProfileStats so we can see which groups/ranks exist
  const query = `query PlayerProfileStats($playerId: ID!) { playerProfileStats(playerId: $playerId) { stats { statId value rank } } }`;
  let rawGroups: unknown = null;
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables: { playerId: id } }),
      signal: AbortSignal.timeout(6000),
    });
    const j = await res.json() as { data?: { playerProfileStats?: Array<{ stats?: Array<{ statId?: string; value?: number; rank?: string }> }> } };
    rawGroups = (j.data?.playerProfileStats ?? []).map((g, i) => ({
      group: i,
      stats: g.stats?.map((s) => `${s.statId}=${s.value} (rank ${s.rank})`),
    }));
  } catch (e) { rawGroups = { __error: String(e) }; }

  return Response.json({ id, name, fetchResult: result, rawGroups });
}
