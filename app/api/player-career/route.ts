export const dynamic = 'force-dynamic';

import redis from '@/app/lib/redis';
import { ESPN_ID_OVERRIDES } from '@/app/lib/espn-player-season';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const CACHE_TTL = 432000; // 120 hours

// ESPN's archive names the same major differently across years — e.g. The Open appears as
// "The Open Championship" (pre-2016), "The 146th Open", "146th Open Championship", or just
// "The Open" — so each tournament gets a matcher over lowercased names instead of one literal
// substring. Matchers are anchored to the START of the name because the impostor events that
// share the flagship's keywords all carry a prefix word: "BMW PGA Championship" (Wentworth),
// "Australian PGA Championship" (Royal Queensland), "British Masters", "Andalucía Masters",
// "South African Open Championship". The real majors have no prefix in ESPN's names.
const EXCLUDE = /senior|women|girls|amateur|junior|adaptive|latin|asia|professional|assistant|club pro/;
const norm = (n: string) => n.replace(/[®™]/g, '').replace(/\s+/g, ' ').trim();
const TOURNAMENT_MATCHERS: Record<string, (raw: string) => boolean> = {
  players: (raw) => {
    const n = norm(raw);
    return !EXCLUDE.test(n) && /^(the )?players championship\b/.test(n);
  },
  masters: (raw) => {
    const n = norm(raw);
    return !EXCLUDE.test(n) && /^(the )?masters( tournament)?$/.test(n);
  },
  pga: (raw) => {
    const n = norm(raw);
    return !EXCLUDE.test(n) && /^(\d{4} )?pga championship$/.test(n);
  },
  'us-open': (raw) => {
    const n = norm(raw);
    return !EXCLUDE.test(n) && /^(\d{4} )?(u\.s\.|us) open( championship)?$/.test(n);
  },
  open: (raw) => {
    const n = norm(raw);
    if (EXCLUDE.test(n)) return false;
    return (
      n === 'the open' ||
      /^the (\d+(st|nd|rd|th) )?open$/.test(n) ||
      /^\d+(st|nd|rd|th) open$/.test(n) ||
      /^(the )?(\d+(st|nd|rd|th) )?open championship$/.test(n) ||
      /^(the )?british open$/.test(n)
    );
  },
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

  const matches = TOURNAMENT_MATCHERS[tournamentId];
  if (!matches) return Response.json({ results: null });

  const cacheKey = `player-career:v5:${tournamentId}:${name}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ results: JSON.parse(cached) });

    const espnId = await getEspnId(name);
    if (!espnId) return Response.json({ results: null });

    const currentYear = new Date().getFullYear();
    const startYear = 1990;
    const years = Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i);
    const opts = { next: { revalidate: 3600 } };

    // ESPN rate-limits bursts from this fan-out (36 years × every event entered). A dropped
    // year used to vanish silently AND the partial list got cached for 5 days. Now any
    // non-404 fetch failure marks the result degraded: still returned, but never cached,
    // so the next open of the tab retries the missing years.
    let degraded = false;

    const results: CareerResult[] = (
      await Promise.all(
        years.map(async (year) => {
          let logRes: Response;
          try {
            logRes = await fetch(
              // limit=300: the eventlog is paginated (~25/page by default). Players with many
              // worldwide starts (e.g. PGA + Japan tours) overflow page 1 and the major silently
              // vanished from their career results — Matsuyama was missing 2017–2021 Masters.
              `${ESPN_CORE}/pga/seasons/${year}/athletes/${espnId}/eventlog?limit=300`,
              opts,
            );
          } catch {
            degraded = true;
            return null;
          }
          if (!logRes.ok) {
            if (logRes.status !== 400 && logRes.status !== 404) degraded = true;
            return null;
          }
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
              try {
                const eRes = await fetch(
                  `${ESPN_CORE}/${league}/events/${eventId}`,
                  opts,
                );
                if (!eRes.ok) {
                  if (eRes.status !== 400 && eRes.status !== 404) degraded = true;
                  return null;
                }
                const eData = await eRes.json();
                return { eventId, league, eData };
              } catch {
                degraded = true;
                return null;
              }
            }),
          );

          const match = eventDetails.find(
            (e) => e && matches(((e.eData.name as string) ?? '').toLowerCase()),
          );
          if (!match) return null;

          const { eventId, league, eData } = match;
          const courses = eData.courses as Array<{ name?: string }> | undefined;
          const course = courses?.[0]?.name ?? '';

          let statusData: unknown = null;
          try {
            const statusRes = await fetch(
              `${ESPN_CORE}/${league}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/status`,
              opts,
            );
            if (statusRes.ok) statusData = await statusRes.json();
            else if (statusRes.status !== 400 && statusRes.status !== 404) degraded = true;
          } catch {
            degraded = true;
          }
          const position = getPosition(statusData as Parameters<typeof getPosition>[0]);

          if (position === '--') return null;
          return { year, course, position };
        }),
      )
    )
      .filter((r): r is CareerResult => r !== null)
      .sort((a, b) => b.year - a.year);

    if (results.length > 0 && !degraded) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
    }
    return Response.json({ results: results.length > 0 ? results : null });
  } catch {
    return Response.json({ results: null });
  }
}
