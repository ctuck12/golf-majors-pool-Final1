export const dynamic = 'force-dynamic';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.europeantour.com/dpworld-tour/rankings/overview/rankings/',
  'Origin': 'https://www.europeantour.com',
};

async function probe(url: string): Promise<{ url: string; status: number; preview: string }> {
  try {
    const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    const text = await res.text().catch(() => '');
    return { url, status: res.status, preview: text.slice(0, 300) };
  } catch (e) {
    return { url, status: 0, preview: String(e) };
  }
}

export async function GET() {
  const candidates = [
    'https://www.europeantour.com/api/sportdata/Rankings/Tour/1/Season/2026',
    'https://www.europeantour.com/api/sportdata/Rankings/Tour/2/Season/2026',
    'https://www.europeantour.com/api/sportdata/Rankings/Tour/3/Season/2026',
    'https://www.europeantour.com/api/sportdata/Rankings/Tour/4/Season/2026',
    'https://www.europeantour.com/api/sportdata/Rankings/Tour/5/Season/2026',
    'https://www.europeantour.com/api/sportdata/Rankings/Tour/12/Season/2026',
    'https://www.europeantour.com/api/rankings/race-to-dubai?season=2026',
    'https://www.europeantour.com/feed/rankings/race-to-dubai/2026.json',
  ];

  const results = await Promise.all(candidates.map(probe));
  return Response.json(results);
}
