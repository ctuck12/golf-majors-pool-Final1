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

// Confirm a candidate PGA id belongs to the expected player by reading player(id){ displayName }.
async function nameForId(id: string): Promise<string | null> {
  const j = await gql(`query P($id: ID!){ player(id: $id){ id displayName } }`, { id });
  return j?.data?.player?.displayName ?? null;
}

export async function GET() {
  // Candidate historical PGA ids for the LIV players not in any current directory.
  const CANDIDATES: Record<string, string[]> = {
    'Sergio Garcia': ['25198', '25184', '24024'],
    'Charl Schwartzel': ['29454', '29268', '30786'],
  };
  const candidateChecks: Record<string, Array<{ id: string; name: string | null; majors: number | string }>> = {};
  for (const [nm, ids] of Object.entries(CANDIDATES)) {
    candidateChecks[nm] = await Promise.all(ids.map(async (id) => ({ id, name: await nameForId(id), majors: await majorCount(id) })));
  }
  return Response.json({ candidateChecks });
}
