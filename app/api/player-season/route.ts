export const dynamic = 'force-dynamic';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/pga';

async function getEspnId(name: string): Promise<string | null> {
  const res = await fetch(
    `https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(name)}&limit=1&type=player&sport=golf`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const player = data.results?.[0]?.contents?.[0];
  const uid: string = player?.uid ?? '';
  return uid.split('~a:')?.[1] ?? null;
}

async function getEventIds(espnId: string): Promise<string[]> {
  const res = await fetch(`${ESPN_CORE}/seasons/2026/athletes/${espnId}/eventlog`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items: Array<{ event: Record<string, string>; played: boolean }> =
    data.events?.items ?? [];
  return items
    .filter((item) => item.played)
    .map((item) => {
      const ref = Object.values(item.event)[0] ?? '';
      return ref.match(/events\/(\d+)/)?.[1] ?? '';
    })
    .filter(Boolean);
}

function fmtScore(val: number | undefined): string {
  if (val === undefined || val === null) return '--';
  if (val === 0) return 'E';
  return val > 0 ? `+${val}` : String(val);
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getPosition(status: {
  position?: { displayName?: string };
  type?: { name?: string } | string;
} | null): string {
  if (!status) return '--';
  const t = typeof status.type === 'string' ? status.type : (status.type as { name?: string })?.name ?? '';
  if (t === 'STATUS_CUT' || t === 'STATUS_MC') return 'CUT';
  if (t === 'STATUS_WD') return 'WD';
  if (t === 'STATUS_DQ') return 'DQ';
  if (t === 'STATUS_MDF') return 'MDF';
  return status.position?.displayName ?? '--';
}

export type SeasonResult = {
  tournament: string;
  date: string;
  position: string;
  score: string;
  earnings: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  if (!name) return Response.json({ results: null });

  try {
    const espnId = await getEspnId(name);
    if (!espnId) return Response.json({ results: null });

    const eventIds = await getEventIds(espnId);
    if (eventIds.length === 0) return Response.json({ results: null });

    const opts = { next: { revalidate: 3600 } };

    const eventResults = await Promise.all(
      eventIds.map(async (eventId) => {
        const competitorBase = `${ESPN_CORE}/events/${eventId}/competitions/${eventId}/competitors/${espnId}`;

        const [eventRes, statsRes, statusRes] = await Promise.all([
          fetch(`${ESPN_CORE}/events/${eventId}`, opts),
          fetch(`${competitorBase}/statistics/0`, opts),
          fetch(`${competitorBase}/status`, opts),
        ]);

        if (!eventRes.ok) return null;

        const [eventData, statsData, statusData] = await Promise.all([
          eventRes.json(),
          statsRes.ok ? statsRes.json() : Promise.resolve(null),
          statusRes.ok ? statusRes.json() : Promise.resolve(null),
        ]);

        const stats: Array<{ name: string; value: number; displayValue: string }> =
          statsData?.splits?.categories?.[0]?.stats ?? [];

        const scoreToParStat = stats.find((s) => s.name === 'scoreToPar');
        const amountStat = stats.find((s) => s.name === 'amount');

        return {
          tournament: (eventData.name as string) ?? '',
          date: (eventData.date as string) ?? '',
          position: getPosition(statusData),
          score: fmtScore(scoreToParStat?.value),
          earnings: amountStat?.displayValue ?? '--',
        };
      }),
    );

    const results: SeasonResult[] = eventResults
      .filter(Boolean)
      .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime())
      .map((r) => ({
        tournament: r!.tournament,
        date: fmtDate(r!.date),
        position: r!.position,
        score: r!.score,
        earnings: r!.earnings,
      }));

    return Response.json({ results: results.length > 0 ? results : null });
  } catch {
    return Response.json({ results: null });
  }
}
