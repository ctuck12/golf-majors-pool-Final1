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
  const ESPN_BASE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/all/seasons/2026/rankings';

  async function espnRanking(id: number) {
    try {
      const res = await fetch(`${ESPN_BASE}/${id}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { id, status: res.status };
      const data = await res.json();
      return { id, name: data.name, type: data.type, count: (data.rankings as unknown[])?.length };
    } catch (e) { return { id, error: String(e) }; }
  }

  async function espnRankingEntries(id: number) {
    try {
      // Get the most recent date ref
      const meta = await fetch(`${ESPN_BASE}/${id}`, { signal: AbortSignal.timeout(5000) });
      if (!meta.ok) return { id, status: meta.status };
      const metaData = await meta.json();
      const refs: Array<{ $ref?: string }> = metaData.rankings ?? [];
      const dateRef = refs[0]?.$ref ?? '';
      const dateMatch = dateRef.match(/dates\/(\d{8})/);
      if (!dateMatch) return { id, noDate: true };
      const res = await fetch(`${ESPN_BASE}/${id}/dates/${dateMatch[1]}?limit=250`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return { id, status: res.status };
      const data = await res.json();
      const entries: unknown[] = data.athletes ?? data.rankings ?? [];
      return { id, date: dateMatch[1], totalEntries: data.count ?? entries.length, first3: entries.slice(0, 3) };
    } catch (e) { return { id, error: String(e) }; }
  }

  const [r1, r2, r3, r4, r5, r6] = await Promise.all([1,2,3,4,5,6].map(espnRanking));
  const results = [r1, r2, r3, r4, r5, r6];

  // If any looks like RTD, fetch its entries
  const rtdCandidate = [r1, r2, r3, r4, r5, r6].find((r: Record<string, unknown>) =>
    String(r.name ?? '').toLowerCase().includes('dubai') ||
    String(r.name ?? '').toLowerCase().includes('race') ||
    String(r.type ?? '').toLowerCase().includes('euro')
  ) as { id?: number } | undefined;
  if (rtdCandidate?.id) {
    (results as unknown[]).push(await espnRankingEntries(rtdCandidate.id));
  }

  return Response.json(results, { headers: { 'Cache-Control': 'no-store' } });
}
