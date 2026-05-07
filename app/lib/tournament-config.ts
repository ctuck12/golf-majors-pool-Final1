export type TournamentMeta = {
  slashGolfTournId: string;
  year: string;
  courseName: string;
  par: number;
};

// tournIds confirmed via /schedule?year=2026 — no "R2026" prefix, just the 3-digit code
export const TOURNAMENT_META: Record<string, TournamentMeta> = {
  players: {
    slashGolfTournId: '011',
    year: '2026',
    courseName: 'TPC Sawgrass',
    par: 72,
  },
  masters: {
    slashGolfTournId: '014',
    year: '2026',
    courseName: 'Augusta National Golf Club',
    par: 72,
  },
  pga: {
    slashGolfTournId: '033',
    year: '2026',
    courseName: 'Aronimink Golf Club',
    par: 70,
  },
  'us-open': {
    slashGolfTournId: '026',
    year: '2026',
    courseName: 'Oakmont Country Club',
    par: 70,
  },
  open: {
    slashGolfTournId: '100',
    year: '2026',
    courseName: 'Royal Portrush Golf Club',
    par: 71,
  },
};
