export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { getActiveSeason } from '@/app/lib/tournament-config';

// Inspect the ESPN cupPoints leaders entries for the Masters-legend field players so we can tell
// why some still get a bogus FedEx rank. espnIds: Couples 91, Singh 392, Weir 453, Olazabal 329,
// Cabrera 65. Also include an active player (Scheffler 9478) as a control.
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const TARGETS: Record<string, string> = {
  '91': 'Fred Couples', '392': 'Vijay Singh', '453': 'Mike Weir',
  '329': 'Jose Maria Olazabal', '65': 'Angel Cabrera', '9478': 'Scottie Scheffler (control)',
};

export async function GET() {
  const season = getActiveSeason();
  const res = await fetch(`${ESPN_CORE}/pga/seasons/${season}/types/2/leaders?limit=336`, { cache: 'no-store' });
  if (!res.ok) return Response.json({ error: `HTTP ${res.status}`, season });
  const data = await res.json();
  const cat = (data.categories as Array<{ name: string; leaders: Array<Record<string, unknown>> }> | undefined)?.find((c) => c.name === 'cupPoints');
  if (!cat) return Response.json({ error: 'no cupPoints category', categories: (data.categories ?? []).map((c: any) => c.name), season });

  const leaders = cat.leaders;
  const out: Record<string, unknown> = { season, leaderCount: leaders.length, sampleKeys: Object.keys(leaders[0] ?? {}) };
  for (const [espnId, label] of Object.entries(TARGETS)) {
    const idx = leaders.findIndex((l) => {
      const ref = String(Object.values((l.athlete ?? {}) as Record<string, string>)[0] ?? '');
      return ref.match(/athletes\/(\d+)/)?.[1] === espnId;
    });
    out[label] = idx === -1 ? 'NOT IN LIST' : { index1: idx + 1, value: leaders[idx].value, displayValue: leaders[idx].displayValue };
  }
  return Response.json(out);
}
