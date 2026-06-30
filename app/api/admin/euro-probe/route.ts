export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Diagnostic: inspect what ESPN's DP World Tour (league "eur") endpoints return for a player,
// so we can find a reliable source of career DP World Tour wins.
// Default id 9037 = Matt Fitzpatrick (multiple European Tour wins).
const EUR = 'https://sports.core.api.espn.com/v2/sports/golf/leagues/eur';

async function j(url: string): Promise<unknown> {
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { __status: r.status, __url: url };
    return await r.json();
  } catch (e) { return { __error: String(e).slice(0, 120), __url: url }; }
}

export async function GET(request: Request) {
  const espnId = new URL(request.url).searchParams.get('id') ?? '9037';

  // 1) statisticslog — what we currently rely on
  const log = await j(`${EUR}/athletes/${espnId}/statisticslog`) as {
    entries?: Array<{ season?: { $ref?: string }; statistics?: Array<{ type?: string; statistics?: { $ref?: string } }> }>;
  };
  const statRefs: string[] = [];
  for (const e of log?.entries ?? []) {
    for (const s of e.statistics ?? []) {
      if (s?.statistics?.$ref) statRefs.push(s.statistics.$ref);
    }
  }

  // 2) Pull the first stats page and list the stat names available (to find a wins stat)
  let firstStatNames: string[] = [];
  let firstStatSample: Record<string, unknown> | null = null;
  const typed2 = statRefs.find((r) => r.includes('/types/2/')) ?? statRefs[0];
  if (typed2) {
    const page = await j(typed2) as { splits?: { categories?: Array<{ name?: string; stats?: Array<{ name?: string; value?: number; displayValue?: string }> }> } };
    const cats = page?.splits?.categories ?? [];
    for (const c of cats) for (const s of c.stats ?? []) {
      firstStatNames.push(`${c.name}.${s.name}=${s.displayValue ?? s.value}`);
    }
    firstStatSample = { ref: typed2 };
  }

  // 3) eventlog approach for a few recent seasons — count position-1 finishes (= wins)
  const seasonsToTry = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014];
  const winsByEventlog: Array<{ season: number; played: number; wins: Array<{ event: string; pos: string }> }> = [];
  for (const season of seasonsToTry) {
    const elog = await j(`${EUR}/seasons/${season}/athletes/${espnId}/eventlog`) as {
      events?: { items?: Array<{ played?: boolean; event?: Record<string, string> }> };
    };
    const items = elog?.events?.items ?? [];
    const played = items.filter((i) => i.played);
    if (played.length === 0) continue;
    const wins: Array<{ event: string; pos: string }> = [];
    // Check each played event's competitor status for position 1
    await Promise.all(played.map(async (it) => {
      const ref = Object.values(it.event ?? {})[0] ?? '';
      const eventId = ref.match(/events\/(\d+)/)?.[1] ?? '';
      if (!eventId) return;
      const status = await j(`${EUR}/events/${eventId}/competitions/${eventId}/competitors/${espnId}/status`) as {
        position?: { displayName?: string; id?: string };
      };
      const pos = status?.position?.displayName ?? '';
      if (pos === '1' || pos === 'T1' || pos === '1st') {
        const ev = await j(`${EUR}/events/${eventId}`) as { name?: string };
        wins.push({ event: ev?.name ?? eventId, pos });
      }
    }));
    winsByEventlog.push({ season, played: played.length, wins });
  }

  const eventlogWinTotal = winsByEventlog.reduce((n, s) => n + s.wins.length, 0);

  return Response.json({
    espnId,
    statisticslog: { entryCount: log?.entries?.length ?? 0, statRefCount: statRefs.length, sampleRefs: statRefs.slice(0, 3) },
    firstStatNames,
    firstStatSample,
    eventlogWinTotal,
    winsByEventlog,
  });
}
