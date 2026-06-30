// Manual player-bio overrides.
//
// Drop confirmed values here for players whose data ESPN and PGA Tour don't provide
// (or provide incorrectly). Any field set here WINS over the live API data and shows
// immediately — no cache bump needed.
//
// Keys MUST match the player's pool name EXACTLY (see app/lib/player-pool.ts).
//
// Field formats:
//   height      e.g. `6'0"`        (use the inch mark, as shown in the UI)
//   weight      e.g. '175 lbs'
//   dob         any parseable date e.g. '1999-05-04' or 'May 4, 1999'
//               (it is reformatted for display and used to compute age automatically)
//   birthPlace  e.g. 'Austin, Texas' or 'Tokyo, Japan'
//   swing       'Right' or 'Left'
//   college     e.g. 'Texas'
//
// NOTE: you do NOT need to add players who simply didn't attend college — the UI already
// shows "*Did not attend college" automatically once the APIs confirm there's no college.

export type BioOverride = Partial<{
  height: string;
  weight: string;
  dob: string;
  birthPlace: string;
  swing: 'Right' | 'Left';
  college: string;
}>;

export const PLAYER_BIO_OVERRIDES: Record<string, BioOverride> = {
  // Add entries here, e.g.:
  // 'Cole Hammer': { height: `6'0"`, weight: '175 lbs', college: 'Texas' },
  // 'Kensei Hirata': { birthPlace: 'Japan', swing: 'Right' },
};
