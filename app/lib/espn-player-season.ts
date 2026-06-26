import { getActiveSeason } from './tournament-config';

const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/golf/leagues';
const LEAGUES = ['pga', 'liv', 'eur'] as const;
type League = (typeof LEAGUES)[number];

export const ESPN_ID_OVERRIDES: Record<string, string> = {
  'Justin Thomas': '4848',
  'John Keefer': '5217048',
};

// Maps pool names to the name ESPN uses for that player
const ESPN_NAME_ALIASES: Record<string, string> = {
  'Tom Kim': 'Joohyung Kim',
};

export async function getEspnId(name: string): Promise<string | null> {
  if (ESPN_ID_OVERRIDES[name]) return ESPN_ID_OVERRIDES[name];
  const searchName = ESPN_NAME_ALIASES[name] ?? name;
  const res = await fetch(
    `https://site.api.espn.com/apis/search/v2?lang=en&region=us&query=${encodeURIComponent(searchName)}&limit=20&type=player`,
    { next: { revalidate: 86400 } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const contents: Array<{ uid?: string }> = data.results?.[0]?.contents ?? [];
  const player = contents.find((c) => c.uid?.includes('s:1100~'));
  const uid: string = player?.uid ?? '';
  return uid.split('~a:')?.[1] ?? null;
}

async function getEventIdsForLeague(
  espnId: string,
  league: League,
): Promise<Array<{ eventId: string; league: League }>> {
  const season = getActiveSeason();
  const res = await fetch(
    `${ESPN_CORE}/${league}/seasons/${season}/athletes/${espnId}/eventlog`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const items: Array<{ event: Record<string, string>; played: boolean }> =
    data.events?.items ?? [];
  return items
    .filter((item) => item.played)
    .map((item) => {
      const ref = Object.values(item.event)[0] ?? '';
      const eventId = ref.match(/events\/(\d+)/)?.[1] ?? '';
      const refLeague = (ref.match(/leagues\/(\w+)\/events/)?.[1] ?? league) as League;
      return { eventId, league: refLeague };
    })
    .filter((e) => e.eventId);
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

export type SeasonResult = {
  tournament: string;
  date: string;
  course: string;
  position: string;
  tour: 'pga' | 'liv' | 'eur';
};

export async function fetchPlayerSeasonResults(name: string): Promise<SeasonResult[]> {
  const espnId = await getEspnId(name);
  if (!espnId) return [];

  const allEvents = (
    await Promise.all(LEAGUES.map((league) => getEventIdsForLeague(espnId, league)))
  ).flat();

  const seen = new Set<string>();
  const uniqueEvents = allEvents.filter(({ eventId }) => {
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    return true;
  });

  if (uniqueEvents.length === 0) return [];

  const opts = { next: { revalidate: 3600 } };

  const eventResults = await Promise.all(
    uniqueEvents.map(async ({ eventId, league }) => {
      const base = `${ESPN_CORE}/${league}`;
      const competitorBase = `${base}/events/${eventId}/competitions/${eventId}/competitors/${espnId}`;

      const [eventRes, statusRes] = await Promise.all([
        fetch(`${base}/events/${eventId}`, opts),
        fetch(`${competitorBase}/status`, opts),
      ]);

      if (!eventRes.ok) return null;

      const [eventData, statusData] = await Promise.all([
        eventRes.json(),
        statusRes.ok ? statusRes.json() : Promise.resolve(null),
      ]);

      const position = getPosition(statusData);
      const courses = eventData.courses as Array<{ name?: string }> | undefined;
      return {
        tournament: (eventData.name as string) ?? '',
        date: (eventData.date as string) ?? '',
        course: courses?.[0]?.name ?? '',
        position,
        tour: league,
      };
    }),
  );

  return eventResults
    .filter((r) => r && r.position !== '--')
    .sort((a, b) => new Date(b!.date).getTime() - new Date(a!.date).getTime())
    .map((r) => ({
      tournament: r!.tournament,
      date: fmtDate(r!.date),
      course: r!.course,
      position: r!.position,
      tour: r!.tour,
    }));
}
