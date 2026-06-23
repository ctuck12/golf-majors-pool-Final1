export const dynamic = 'force-dynamic';

import { gunzipSync } from 'zlib';

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

async function tryGql(label: string, query: string, variables: Record<string, unknown> = {}) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return { label, status: res.status, data };
  } catch (e) {
    return { label, error: String(e) };
  }
}

async function decodePlayerHub(playerId: string) {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PGA_API_KEY, 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      body: JSON.stringify({ query: `query { playerHub(playerId: "${playerId}") { payload } }` }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json() as { data?: { playerHub?: { payload?: string } } };
    const payload = data?.data?.playerHub?.payload;
    if (!payload) return { playerId, error: 'no payload' };
    const buf = Buffer.from(payload, 'base64');
    const json = gunzipSync(buf).toString('utf8');
    const parsed = JSON.parse(json);
    return { playerId, decoded: parsed };
  } catch (e) {
    return { playerId, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    // playerProfileStats for Rory — check for RTD rank
    tryGql('playerProfileStats-rory', `query { playerProfileStats(playerId: "28237") { __typename } }`),
    // Introspect PlayerProfileStats type fully
    tryGql('PlayerProfileStats-type', `{ __type(name: "PlayerProfileStats") { fields { name type { name kind ofType { name } } } } }`),
    // playerTournamentStatus — might include tour standings
    tryGql('playerTournamentStatus-rory', `query { playerTournamentStatus(playerId: "28237") { __typename } }`),
    tryGql('PlayerTournamentStatus-type', `{ __type(name: "PlayerTournamentStatus") { fields { name type { name kind ofType { name } } } } }`),
    // ESPN rankings check — which of 1-6 is RTD?
    tryGql('espn-check', `{ __type(name: "Query") { fields { name } } }`),
  ]);

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
