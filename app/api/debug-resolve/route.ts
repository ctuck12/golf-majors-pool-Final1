export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

export async function GET() {
  let raw: string | null = null;
  try { raw = await redis.get('pga-rest-players:v1'); } catch { /* ignore */ }
  let source = 'redis';
  if (!raw) {
    source = 'fetch';
    try {
      const res = await fetch('https://statdata.pgatour.com/players/player.json', {
        cache: 'no-store', signal: AbortSignal.timeout(8000),
        headers: { 'Referer': 'https://www.pgatour.com/', 'Origin': 'https://www.pgatour.com' },
      });
      source += ` http=${res.status}`;
      if (res.ok) raw = await res.text();
    } catch (e) { source += ` err=${String(e)}`; }
  }
  if (!raw) return Response.json({ source, raw: null });

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (e) { return Response.json({ source, parseError: String(e), head: raw.slice(0, 300) }); }

  const obj = parsed as Record<string, unknown>;
  const topKeys = Object.keys(obj);
  const arr = (obj.plrs ?? obj.players ?? obj.Players ?? (Array.isArray(parsed) ? parsed : [])) as unknown[];
  const sample = Array.isArray(arr) ? arr.slice(0, 3) : null;
  // Find any entry whose stringified content includes "Hoge"
  const hoge = Array.isArray(arr) ? arr.find((p) => JSON.stringify(p).includes('Hoge')) : null;

  return Response.json({
    source,
    topKeys,
    arrLen: Array.isArray(arr) ? arr.length : 'not-array',
    sample,
    hoge,
  });
}
