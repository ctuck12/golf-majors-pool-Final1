export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getEspnId } from '@/app/lib/espn-player-season';

// One-off resolver: for the Masters-legend field players missing IDs, find their PGA Tour id
// (searching the R = PGA Tour and S = Champions directories) and ESPN id, and validate that the
// PGA id returns major results. GET /api/admin/resolve-legends
const GQL_URL = 'https://orchestrator.pgatour.com/graphql';
const GQL_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

const NAMES = ['Danny Willett', 'Mike Weir', 'Charl Schwartzel', 'Sergio Garcia', 'Sam Stevens'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/æ/gi, 'ae').toLowerCase().replace(/[^a-z ]/g, '').trim();

async function gql(query: string, variables?: Record<string, unknown>): Promise<any> {
  try {
    const res = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': GQL_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15000),
    });
    return await res.json();
  } catch (e) { return { error: String(e).slice(0, 150) }; }
}

async function directory(tourCode: string): Promise<Array<{ id: string; displayName: string }>> {
  const j = await gql(`query Dir { playerDirectory(tourCode: ${tourCode}) { players { id displayName } } }`);
  return j?.data?.playerDirectory?.players ?? [];
}

async function majorCount(id: string): Promise<number | string> {
  const j = await gql(`query M($id: String!){ playerProfileMajorResults(playerId:$id){ tournaments { position } } }`, { id });
  if (j?.errors?.length) return `err:${JSON.stringify(j.errors).slice(0, 80)}`;
  return j?.data?.playerProfileMajorResults?.tournaments?.length ?? 0;
}

export async function GET() {
  // Introspect the args/shape of the candidate search queries.
  const introspect = await gql(`{ __type(name: "Query"){ fields { name args { name type { name kind ofType { name } } } type { name kind ofType { name kind ofType { name } } } } } }`);
  const fields = (introspect?.data?.__type?.fields ?? []).filter((f: any) => ['players', 'searchBarFeatures', 'playerHub'].includes(f.name));
  const shapes = fields.map((f: any) => ({
    name: f.name,
    args: (f.args ?? []).map((a: any) => `${a.name}:${a.type?.name ?? a.type?.ofType?.name ?? a.type?.kind}`),
    returns: f.type?.name ?? f.type?.ofType?.name ?? f.type?.ofType?.ofType?.name ?? f.type?.kind,
  }));

  // Try the C (Korn Ferry?) not helpful; instead try `players` with an ids arg is unlikely.
  // Attempt a broad search via `searchBarFeatures` with a guessed arg once shapes known — skipped here.
  return Response.json({ shapes });
}
