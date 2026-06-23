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
  // Decode playerHub for Rory (28237) and Fleetwood (35891) — check for RTD rank in widgets
  const [rory, fleetwood] = await Promise.all([
    decodePlayerHub('28237'),
    decodePlayerHub('35891'),
  ]);
  const results = [rory, fleetwood];

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
