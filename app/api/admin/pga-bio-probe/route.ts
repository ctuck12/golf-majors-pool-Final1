export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const PGA_GQL = 'https://orchestrator.pgatour.com/graphql';
const PGA_API_KEY = 'da2-gsrx5bibzbb4njvhl7t37pzxpq';

function headers() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': PGA_API_KEY,
    'Referer': 'https://www.pgatour.com/',
    'Origin': 'https://www.pgatour.com',
  };
}

// Sample players with known pgaTourIds that are currently missing height/weight,
// plus Scottie Scheffler (46046) as a control to confirm a source works at all.
const SAMPLE: Array<{ name: string; id: string }> = [
  { name: 'Scottie Scheffler (control)', id: '46046' },
  { name: 'Cole Hammer', id: '47987' },
  { name: 'Caleb Surratt', id: '64054' },
  { name: 'Tom Kim', id: '55182' },
  { name: 'Ryan Fox', id: '29936' },
  { name: 'Matthew Jordan', id: '55955' },
];

// Candidate GQL queries — capture raw data AND errors (PGA errors often suggest valid field names).
const QUERIES: Array<{ label: string; query: string }> = [
  { label: 'player', query: `query P($id: ID!){ player(id:$id){ id firstName lastName height weight country age } }` },
  { label: 'playerProfileOverview', query: `query P($id: ID!){ playerProfileOverview(playerId:$id){ id } }` },
  { label: 'playerProfileHeader', query: `query P($id: ID!){ playerProfileHeader(playerId:$id){ id } }` },
  { label: 'playerBioV2', query: `query P($id: ID!){ playerBioV2(playerId:$id){ id } }` },
  { label: 'profileKeyData', query: `query P($id: ID!){ profileKeyData(playerId:$id){ id } }` },
];

async function runQuery(label: string, query: string, id: string): Promise<unknown> {
  try {
    const res = await fetch(PGA_GQL, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ query, variables: { id } }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    return { label, status: res.status, body: text.slice(0, 700) };
  } catch (e) { return { label, error: String(e).slice(0, 120) }; }
}

async function probeRest(id: string): Promise<unknown> {
  try {
    const res = await fetch('https://statdata.pgatour.com/players/player.json', {
      cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
    });
    if (!res.ok) return { rest: `HTTP ${res.status}` };
    const data = await res.json() as { plrs?: Record<string, unknown>[] };
    const plrs = data.plrs ?? [];
    const p = plrs.find((x) => String(x.pid ?? x.id ?? '') === id);
    return { rest: { totalPlayers: plrs.length, found: !!p, sampleKeys: p ? Object.keys(p).slice(0, 30) : [], ht: p?.ht, wt: p?.wt } };
  } catch (e) { return { rest: 'error: ' + String(e).slice(0, 100) }; }
}

export async function GET() {
  const out: Record<string, unknown> = {};
  // Run all candidate queries against the control player first to learn the schema.
  out.controlQueries = await Promise.all(QUERIES.map((q) => runQuery(q.label, q.query, '46046')));
  out.restProbe = await probeRest('46046');
  // Then the `player` query for each sample to see who actually returns height/weight.
  out.perPlayer = await Promise.all(SAMPLE.map(async (s) => ({
    name: s.name, id: s.id,
    player: await runQuery('player', QUERIES[0].query, s.id),
  })));
  return Response.json(out);
}
