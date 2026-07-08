// Lightweight, client-safe helper to pick the current/upcoming tournament and its
// tab logo — used by the commissioner tool pages, which don't have the main app's
// tournament state. Mirrors the schedule + tab-logo mapping in app/page.tsx.

export type HeaderTournament = { id: string; name: string; logo: string; color: string };

// `color` matches entriesTournamentSolid (the tournament header color) in app/page.tsx.
const SCHEDULE: HeaderTournament[] = [
  { id: 'players', name: 'The Players', logo: '/players-tab-logo.webp', color: '#173b63' },
  { id: 'masters', name: 'The Masters', logo: '/masters-tab-logo.png', color: '#2c6449' },
  { id: 'pga', name: 'PGA Championship', logo: '/pga-tab-logo.png', color: '#B09963' },
  { id: 'us-open', name: 'U.S. Open', logo: '/us-open-tab-logo.png', color: '#BE3436' },
  { id: 'open', name: 'The Open', logo: '/open-tab-logo.png', color: '#173b63' },
];

// id + display name for every tournament, in schedule order — for the commissioner tool's
// per-tournament salary selector (lets past events be backfilled).
// White-knockout versions of the tab logos (white marks with each tournament's signature element
// kept in brand color) for use on dark/colored headers. Generated from the tab logos.
export const KNOCKOUT_TAB_LOGOS: Record<string, string> = {
  players: '/knockout-players.png',
  masters: '/knockout-masters.png',
  pga: '/knockout-pga.png',
  'us-open': '/knockout-us-open.png',
  open: '/knockout-open.png',
};

export const TOURNAMENT_OPTIONS = SCHEDULE.map((t) => ({ id: t.id, name: t.name, color: t.color }));

// First-tee times (UTC) match app/page.tsx TOURNAMENTS.
// All tournament ids, in schedule order — used to store/read salary lists per tournament.
export const ALL_TOURNAMENT_IDS = ['players', 'masters', 'pga', 'us-open', 'open'] as const;

const FIRST_TEE_UTC: Record<string, string> = {
  players: '2026-03-12T11:40:00Z',
  masters: '2026-04-09T11:30:00Z',
  pga: '2026-05-14T11:20:00Z',
  'us-open': '2026-06-18T11:15:00Z',
  open: '2026-07-16T05:35:00Z',
};

// Returns the tournament in progress or up next. A major stays "current" through the
// Monday after it concludes (~5 days after first tee); once past that it rolls to the
// next event. After the final major of the season it rolls back to the first.
export function getHeaderTournament(now: Date = new Date()): HeaderTournament {
  const sorted = SCHEDULE.slice().sort(
    (a, b) => new Date(FIRST_TEE_UTC[a.id]).getTime() - new Date(FIRST_TEE_UTC[b.id]).getTime(),
  );
  for (const t of sorted) {
    const firstTee = new Date(FIRST_TEE_UTC[t.id]).getTime();
    const concludeAt = firstTee + 5 * 24 * 60 * 60 * 1000;
    if (now.getTime() <= concludeAt) return t;
  }
  return sorted[0];
}
