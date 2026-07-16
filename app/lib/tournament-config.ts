// Returns the active golf season year. The PGA/DP World season rolls over on
// Nov 1 each year (e.g. Nov 1 2026 → season 2027). Adjust cutoff if needed.
export function getActiveSeason(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-based
  return month >= 11 ? year + 1 : year;
}

export type TournamentMeta = {
  // PGA Tour 3-digit tournament code (builds GraphQL ids like R2026100 for the stats APIs).
  // Live scoring is ESPN-only via espnEventId — no paid feeds.
  pgaTournCode: string;
  year: string;
  courseName: string;
  par: number;
  espnEventId?: string;
  // UTC ISO — picks lock and cron notStarted bypass trigger at this time
  lockAtUtc?: string;
};

// Look up tournament meta by ESPN event ID
export function getTournamentMetaByEspnId(espnEventId: string): TournamentMeta | undefined {
  return Object.values(TOURNAMENT_META).find((m) => m.espnEventId === espnEventId);
}

// 3-digit PGA Tour tournament codes (no "R2026" prefix) — used only for PGA Tour GraphQL stat ids
// ESPN event IDs confirmed via site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard
export const TOURNAMENT_META: Record<string, TournamentMeta> = {
  players: {
    pgaTournCode: '011',
    year: '2026',
    courseName: 'TPC Sawgrass',
    par: 72,
    espnEventId: '401811937',
    lockAtUtc: '2026-03-12T11:40:00Z', // 7:40 AM EDT
  },
  masters: {
    pgaTournCode: '014',
    year: '2026',
    courseName: 'Augusta National Golf Club',
    par: 72,
    espnEventId: '401811941',
    lockAtUtc: '2026-04-09T11:30:00Z', // 7:30 AM EDT
  },
  pga: {
    pgaTournCode: '033',
    year: '2026',
    courseName: 'Aronimink Golf Club',
    par: 70,
    espnEventId: '401811947',
    lockAtUtc: '2026-05-14T11:20:00Z', // 7:20 AM EDT
  },
  'us-open': {
    pgaTournCode: '026',
    year: '2026',
    courseName: 'Shinnecock Hills Golf Club',
    par: 70,
    espnEventId: '401811952',
    lockAtUtc: '2026-06-18T11:15:00Z', // 7:15 AM EDT
  },
  open: {
    pgaTournCode: '100',
    year: '2026',
    courseName: 'Royal Birkdale Golf Club',
    par: 70,
    espnEventId: '401811957',
    lockAtUtc: '2026-07-16T05:35:00Z', // 6:35 AM BST
  },
};
