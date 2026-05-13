export type TournamentMeta = {
  slashGolfTournId: string;
  year: string;
  courseName: string;
  par: number;
  espnEventId?: string;
  dataSource?: 'slashgolf' | 'espn'; // defaults to 'slashgolf' if omitted
};

// tournIds confirmed via /schedule?year=2026 — no "R2026" prefix, just the 3-digit code
// ESPN event IDs confirmed via site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard
export const TOURNAMENT_META: Record<string, TournamentMeta> = {
  players: {
    slashGolfTournId: '011',
    year: '2026',
    courseName: 'TPC Sawgrass',
    par: 72,
    // not tracked this year
  },
  masters: {
    slashGolfTournId: '014',
    year: '2026',
    courseName: 'Augusta National Golf Club',
    par: 72,
    espnEventId: '401811941',
    // tournamentComplete — cron skips it; dataSource irrelevant
  },
  pga: {
    slashGolfTournId: '033',
    year: '2026',
    courseName: 'Aronimink Golf Club',
    par: 70,
    espnEventId: '401811947',
    dataSource: 'espn',
  },
  'us-open': {
    slashGolfTournId: '026',
    year: '2026',
    courseName: 'Oakmont Country Club',
    par: 70,
    espnEventId: '401811952',
    dataSource: 'espn',
  },
  open: {
    slashGolfTournId: '100',
    year: '2026',
    courseName: 'Royal Portrush Golf Club',
    par: 71,
    espnEventId: '401811957',
    dataSource: 'espn',
  },
};
