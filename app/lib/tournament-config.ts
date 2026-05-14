export type TournamentMeta = {
  slashGolfTournId: string;
  year: string;
  courseName: string;
  par: number;
  espnEventId?: string;
  dataSource?: 'slashgolf' | 'espn'; // defaults to 'slashgolf' if omitted
  // UTC ISO — picks lock and cron notStarted bypass trigger at this time
  lockAtUtc?: string;
};

// tournIds confirmed via /schedule?year=2026 — no "R2026" prefix, just the 3-digit code
// ESPN event IDs confirmed via site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard
export const TOURNAMENT_META: Record<string, TournamentMeta> = {
  players: {
    slashGolfTournId: '011',
    year: '2026',
    courseName: 'TPC Sawgrass',
    par: 72,
    lockAtUtc: '2026-03-12T11:40:00Z', // 7:40 AM EDT
    // not tracked this year
  },
  masters: {
    slashGolfTournId: '014',
    year: '2026',
    courseName: 'Augusta National Golf Club',
    par: 72,
    espnEventId: '401811941',
    lockAtUtc: '2026-04-09T11:30:00Z', // 7:30 AM EDT
    // tournamentComplete — cron skips it; dataSource irrelevant
  },
  pga: {
    slashGolfTournId: '033',
    year: '2026',
    courseName: 'Aronimink Golf Club',
    par: 70,
    espnEventId: '401811947',
    dataSource: 'espn',
    lockAtUtc: '2026-05-14T11:20:00Z', // 7:20 AM EDT
  },
  'us-open': {
    slashGolfTournId: '026',
    year: '2026',
    courseName: 'Oakmont Country Club',
    par: 70,
    espnEventId: '401811952',
    dataSource: 'espn',
    lockAtUtc: '2026-06-18T11:15:00Z', // 7:15 AM EDT
  },
  open: {
    slashGolfTournId: '100',
    year: '2026',
    courseName: 'Royal Portrush Golf Club',
    par: 71,
    espnEventId: '401811957',
    dataSource: 'espn',
    lockAtUtc: '2026-07-16T05:35:00Z', // 6:35 AM BST
  },
};
