export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const CACHE_TTL = 432000; // 120 hours

const ESPN_ID_OVERRIDES: Record<string, string> = {
  'Justin Thomas': '4848',
  'John Keefer': '5217048',
};

const TOURNAMENT_PATTERNS: Record<string, string> = {
  'players': 'players championship',
  'masters': 'masters',
  'pga': 'pga championship',
  'us-open': 'u.s. open',
  'open': 'the open championship',
};

async function getEspnId(name: string): Promise<string | null> {
  if (ESPN_ID_OVERRIDES[name]) return ESPN_ID_OVERRIDES[name];
  const res = await fetch(
    `https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(name)}&limit=20&type=player`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const contents: Array<{ uid?: string }> = data.results?.[0]?.contents ?? [];
  const player = contents.find((c) => c.uid?.includes('s:1100~'));
  const uid: string = player?.uid ?? '';
  return uid.split('~a:')?.[1] ?? null;
}

function getPosition(status: {
  position?: { displayName?: string };
  type?: { name?: string } | string;
} | null): string {
  if (!status) return '--';
  const t =
    typeof status.type === 'string'
      ? status.type
      : (status.type as { name?: string })?.name ?? '';
  if (t === 'STATUS_CUT' || t === 'STATUS_MC') return 'CUT';
  if (t === 'STATUS_WD') return 'WD';
  if (t === 'STATUS_DQ') return 'DQ';
  if (t === 'STATUS_MDF') return 'MDF';
  return status.position?.displayName ?? '--';
}

export type CareerResult = {
  year: number;
  course: string;
  position: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const tournamentId = searchParams.get('tournamentId') ?? '';
  if (!name || !tournamentId) return Response.json({ results: null });

  const pattern = TOURNAMENT_PATTERNS[tournamentId];
  if (!pattern) return Response.json({ results: null });

  const cacheKey = `player-career:${tournamentId}:${name}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ results: JSON.parse(cached) });

    const espnId = await getEspnId(name);
    if (!espnId) return Response.json({ results: null });

    const years = Array.from({ length: 16 }, (_, i) => 2010 + i); // 2010–2025
    const opts = { next: { revalidate: 3600 } };

    const results: CareerResult[] = (
      await Promise.all(
        years.map(async (year) => {
          const logRes = await fetch(
            `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/eventlog`,
            opts,
          );
          if (!logRes.ok) return null;
          const logData = await logRes.json();
          const items: Array<{ event: Record<string, string>; played: boolean }> =
            logData.events?.items ?? [];

          const playedEvents = items
            .filter((i) => i.played)
            .map((i) => {
              const ref = Object.values(i.event)[0] ?? '';
              const eventId = ref.match(/events\/(\d+)/)?.[1] ?? '';
              const league = (ref.match(/leagues\/(\w+)\/events/)?.[1] ?? 'pga') as string;
              return { eventId, league };
            })
            .filter((e) => e.eventId);

          // Fetch all played event details in parallel, find the matching major
          const eventDetails = await Promise.all(
            playedEvents.map(async ({ eventId, league }) => {
              const eRes = await fetch(
                `${ESPN_CORE}/${league}/events/${eventId}`,
                opts,
              );
              if (!eRes.ok) return null;
              const eData = await eRes.json();
              return { eventId, league, eData };
            }),
          );

          const match = eventDetails.find(
            (e) => e && (e.eData.name as string)?.toLowerCase().includes(pattern),
          );
          if (!match) return null;

          const { eventId, league, eData } = match;
          const courses = eData.courses as Array<{ name?: string }> | undefined;
          const course = courses?.[0]?.name ?? '';

          const statusRes = await fetch(
            `${ESPN_CORE}/${league}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/status`,
            opts,
          );
          const statusData = statusRes.ok ? await statusRes.json() : null;
          const position = getPosition(statusData);

          if (position === '--') return null;
          return { year, course, position };
        }),
      )
    )
      .filter((r): r is CareerResult => r !== null)
      .sort((a, b) => b.year - a.year);

    if (results.length > 0) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
    }
    return Response.json({ results: results.length > 0 ? results : null });
  } catch {
    return Response.json({ results: null });
  }
}
