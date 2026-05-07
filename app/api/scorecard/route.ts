export const dynamic = 'force-dynamic';

const TOURNAMENT_FEEDS: Record<string, { espnTournamentId: string; courseName: string; par: number }> = {
  players:  { espnTournamentId: '401811937', courseName: 'TPC Sawgrass',              par: 72 },
  masters:  { espnTournamentId: '401811941', courseName: 'Augusta National Golf Club', par: 72 },
  pga:      { espnTournamentId: '401811947', courseName: 'Aronimink Golf Club',        par: 70 },
  'us-open':{ espnTournamentId: '401811952', courseName: 'Oakmont Country Club',       par: 70 },
  open:     { espnTournamentId: '401811957', courseName: 'Royal Portrush Golf Club',   par: 71 },
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function norm(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\./g, '').trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findCompetitor(competitors: any[], playerName: string) {
  const target = norm(playerName);
  return competitors.find((c) => {
    const display = norm(c.athlete?.displayName ?? '');
    return display === target || display.includes(target) || target.includes(display);
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'pga';
  const playerName  = searchParams.get('playerName') ?? '';

  const feed = TOURNAMENT_FEEDS[tournamentId];
  if (!feed) return Response.json({ error: 'Unknown tournament' }, { status: 400 });

  const headers = { 'user-agent': UA };

  try {
    // ── 1. Try ESPN scorecard endpoint (hole-by-hole) ──────────────────────────
    const scRes = await fetch(
      `https://site.web.api.espn.com/apis/site/v2/sports/golf/leaderboard/scorecards?event=${feed.espnTournamentId}`,
      { cache: 'no-store', headers },
    );

    if (scRes.ok) {
      const scData = await scRes.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const competitors: any[] = scData.scorecards ?? scData.competitors ?? [];
      const competitor = findCompetitor(competitors, playerName);

      if (competitor) {
        const rounds: { round: number; holes: { hole: number; par: number; score: number | null; label: string }[] }[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const round of (competitor.rounds ?? competitor.scorecardEntries ?? [])) {
          const roundNum = round.period ?? round.round ?? rounds.length + 1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const holes = (round.linescores ?? round.holes ?? []).map((h: any, idx: number) => ({
            hole: h.hole?.number ?? h.holeNumber ?? idx + 1,
            par:  h.hole?.par ?? h.par ?? 0,
            score: h.score?.value ?? h.value ?? null,
            label: h.score?.displayValue ?? h.displayValue ?? '--',
          }));
          if (holes.length) rounds.push({ round: roundNum, holes });
        }

        if (rounds.length) {
          const courseName = scData.event?.venues?.[0]?.fullName ?? feed.courseName;
          const par = Number(scData.event?.competitions?.[0]?.parValue ?? feed.par);
          return Response.json({ courseName, par, rounds, source: 'espn-scorecards' });
        }
      }
    }

    // ── 2. Fall back to ESPN leaderboard JSON for round totals ─────────────────
    const lbRes = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?event=${feed.espnTournamentId}`,
      { cache: 'no-store', headers },
    );

    if (!lbRes.ok) throw new Error(`ESPN leaderboard ${lbRes.status}`);

    const lbData = await lbRes.json();
    const event = lbData.events?.[0];
    const competition = event?.competitions?.[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = competition?.competitors ?? [];
    const courseName = event?.venues?.[0]?.fullName ?? feed.courseName;
    const par = Number(competition?.parValue ?? feed.par);

    const competitor = findCompetitor(competitors, playerName);
    if (!competitor) {
      return Response.json({ courseName, par, rounds: [], source: 'espn-leaderboard', message: 'Player not found' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rounds = (competitor.linescores ?? []).map((ls: any, i: number) => ({
      round: i + 1,
      score: ls.value ?? ls.displayValue ?? '--',
      holes: [],
    }));

    return Response.json({ courseName, par, rounds, source: 'espn-leaderboard' });
  } catch {
    return Response.json({ courseName: feed.courseName, par: feed.par, rounds: [], source: 'error' });
  }
}
