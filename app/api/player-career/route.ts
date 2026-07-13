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
// Some seasons carry a year prefix ("2021 Masters Tournament", "2017 Masters Tournament");
// strip it before matching so the anchored patterns still hit.
const norm = (n: string) => n.replace(/[®™]/g, '').replace(/\s+/g, ' ').trim().replace(/^(19|20)\d{2} /, '');
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

// Pre-2010 titles that ESPN's per-athlete event logs can't reach (their archive floor is
// ~2010) — hand-entered so past champions show their wins. Merged into every response,
// including cached ones, and never written to the cache. Position '1' matches how ESPN
// labels a winner. Keyed by the exact name the popup passes (pool / legend display name).
const HISTORIC_WINS: Record<string, Record<string, CareerResult[]>> = {
  open: {
    'Padraig Harrington': [
      { year: 2008, course: 'Royal Birkdale GC', position: '1' },
      { year: 2007, course: 'Carnoustie Golf Links', position: '1' },
    ],
    'Stewart Cink': [{ year: 2009, course: 'Turnberry (Ailsa Course)', position: '1' }],
    'David Duval': [{ year: 2001, course: 'Royal Lytham & St. Annes Golf Club', position: '1' }],
    'Ernie Els': [{ year: 2002, course: 'Muirfield Golf Links', position: '1' }],
    'John Daly': [{ year: 1995, course: 'St Andrews Links (Old Course)', position: '1' }],
    'Tiger Woods': [
      { year: 2006, course: 'Royal Liverpool GC', position: '1' },
      { year: 2005, course: 'St Andrews Links (Old Course)', position: '1' },
      { year: 2000, course: 'St Andrews Links (Old Course)', position: '1' },
    ],
  },
  'us-open': {
    'Lucas Glover': [{ year: 2009, course: 'Bethpage State Park (Black Course)', position: '1' }],
    'Ernie Els': [
      { year: 1997, course: 'Congressional Country Club', position: '1' },
      { year: 1994, course: 'Oakmont Country Club', position: '1' },
    ],
    'Angel Cabrera': [{ year: 2007, course: 'Oakmont Country Club', position: '1' }],
    'Tiger Woods': [
      { year: 2008, course: 'Torrey Pines (South Course)', position: '1' },
      { year: 2002, course: 'Bethpage State Park (Black Course)', position: '1' },
      { year: 2000, course: 'Pebble Beach Golf Links', position: '1' },
    ],
  },
  masters: {
    'Zach Johnson': [{ year: 2007, course: 'Augusta National Golf Club', position: '1' }],
    'Mike Weir': [{ year: 2003, course: 'Augusta National Golf Club', position: '1' }],
    'Angel Cabrera': [{ year: 2009, course: 'Augusta National Golf Club', position: '1' }],
    'Phil Mickelson': [
      { year: 2006, course: 'Augusta National Golf Club', position: '1' },
      { year: 2004, course: 'Augusta National Golf Club', position: '1' },
    ],
    'Tiger Woods': [
      { year: 2005, course: 'Augusta National Golf Club', position: '1' },
      { year: 2002, course: 'Augusta National Golf Club', position: '1' },
      { year: 2001, course: 'Augusta National Golf Club', position: '1' },
      { year: 1997, course: 'Augusta National Golf Club', position: '1' },
    ],
    'Vijay Singh': [{ year: 2000, course: 'Augusta National Golf Club', position: '1' }],
    'José María Olazábal': [
      { year: 1999, course: 'Augusta National Golf Club', position: '1' },
      { year: 1994, course: 'Augusta National Golf Club', position: '1' },
    ],
    'Jose Maria Olazabal': [
      { year: 1999, course: 'Augusta National Golf Club', position: '1' },
      { year: 1994, course: 'Augusta National Golf Club', position: '1' },
    ],
    'Fred Couples': [{ year: 1992, course: 'Augusta National Golf Club', position: '1' }],
  },
  pga: {
    'Y.E. Yang': [{ year: 2009, course: 'Hazeltine National Golf Club', position: '1' }],
    'Padraig Harrington': [{ year: 2008, course: 'Oakland Hills Country Club', position: '1' }],
    'Shaun Micheel': [{ year: 2003, course: 'Oak Hill Country Club', position: '1' }],
    'Phil Mickelson': [{ year: 2005, course: 'Baltusrol Golf Club', position: '1' }],
    'Vijay Singh': [
      { year: 2004, course: 'Whistling Straits', position: '1' },
      { year: 1998, course: 'Sahalee Country Club', position: '1' },
    ],
    'John Daly': [{ year: 1991, course: 'Crooked Stick Golf Club', position: '1' }],
    'Tiger Woods': [
      { year: 2007, course: 'Southern Hills Country Club', position: '1' },
      { year: 2006, course: 'Medinah Country Club', position: '1' },
      { year: 2000, course: 'Valhalla Golf Club', position: '1' },
      { year: 1999, course: 'Medinah Country Club', position: '1' },
    ],
  },
  players: {
    'Sergio Garcia': [{ year: 2008, course: 'TPC Sawgrass', position: '1' }],
    'Phil Mickelson': [{ year: 2007, course: 'TPC Sawgrass', position: '1' }],
    'Tiger Woods': [{ year: 2001, course: 'TPC Sawgrass', position: '1' }],
    'Fred Couples': [{ year: 1996, course: 'TPC Sawgrass', position: '1' }],
  },
};

function withHistoricWins(
  tournamentId: string,
  name: string,
  results: CareerResult[] | null,
): CareerResult[] | null {
  const extra = HISTORIC_WINS[tournamentId]?.[name];
  if (!extra?.length) return results;
  const base = results ?? [];
  const merged = [...base, ...extra.filter((h) => !base.some((r) => r.year === h.year))];
  merged.sort((a, b) => b.year - a.year);
  return merged;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name') ?? '';
  const tournamentId = searchParams.get('tournamentId') ?? '';
  if (!name || !tournamentId) return Response.json({ results: null });

  const matches = TOURNAMENT_MATCHERS[tournamentId];
  if (!matches) return Response.json({ results: null });

  const cacheKey = `player-career:v6:${tournamentId}:${name}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return Response.json({ results: withHistoricWins(tournamentId, name, JSON.parse(cached)) });

    const espnId = await getEspnId(name);
    if (!espnId) return Response.json({ results: withHistoricWins(tournamentId, name, null) });

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

          // A wraparound/COVID-era season can contain TWO editions of the same major (ESPN's
          // 2021 season holds both the Nov-2020 and Apr-2021 Masters, and both the Sep-2020
          // and Jun-2021 U.S. Opens), so collect every match and label each by the event's
          // actual DATE — not the season number the eventlog was fetched under.
          const matched = eventDetails.filter(
            (e): e is NonNullable<typeof e> => !!e && matches(((e.eData.name as string) ?? '').toLowerCase()),
          );
          if (matched.length === 0) return null;

          return Promise.all(
            matched.map(async ({ eventId, league, eData }) => {
              const courses = eData.courses as Array<{ name?: string }> | undefined;
              const course = courses?.[0]?.name ?? '';
              const dateYear = parseInt(String(eData.date ?? '').slice(0, 4), 10);
              const displayYear = dateYear >= 1990 && dateYear <= 2100 ? dateYear : year;

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
              return { eventId, year: displayYear, course, position };
            }),
          );
        }),
      )
    )
      .flat()
      .filter((r): r is CareerResult & { eventId: string } => r !== null)
      // The same event can surface in adjacent season eventlogs — dedupe by event, then by year.
      .filter((r, i, arr) => arr.findIndex((o) => o.eventId === r.eventId) === i)
      .filter((r, i, arr) => arr.findIndex((o) => o.year === r.year) === i)
      .map(({ year, course, position }) => ({ year, course, position }))
      .sort((a, b) => b.year - a.year);

    if (results.length > 0 && !degraded) {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(results));
    }
    return Response.json({ results: withHistoricWins(tournamentId, name, results.length > 0 ? results : null) });
  } catch {
    return Response.json({ results: withHistoricWins(tournamentId, name, null) });
  }
}
