// Manual player-bio overrides.
//
// Drop confirmed values here for players whose data ESPN and PGA Tour don't provide
// (or provide incorrectly). Any field set here WINS over the live API data and shows
// immediately — no cache bump needed. EMPTY strings are ignored, so the stubbed entries
// below are safe to leave as-is until you fill them in.
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
//   college     e.g. 'Texas'  — ONLY fill if the player actually attended college.
//               If they didn't attend, leave it blank: the UI already shows
//               "*Did not attend college" automatically.

export type BioOverride = Partial<{
  height: string;
  weight: string;
  dob: string;
  birthPlace: string;
  swing: string; // 'Right' | 'Left'
  college: string;
}>;

// Checklist of players with bio gaps as of the last audit, ordered by how much is missing.
// Fill in the empty strings; delete fields you can't find. The 2 "all six" players aren't
// on ESPN or PGA Tour, so everything must be entered manually.
export const PLAYER_BIO_OVERRIDES: Record<string, BioOverride> = {
  // ---- Missing all six (no record on either API) ----
  'A.J. Ewart':                 { dob: 'May 7, 1999', birthPlace: '', height: '', weight: '', swing: '', college: '' },
  'Davis Chatfield':            { dob: 'May 28, 1999', birthPlace: '', height: '', weight: '', swing: '', college: '' },

  // ---- Missing 4–5 fields ----
  'Zach Bauchou':               { birthPlace: '', height: '', weight: '', swing: '', college: '' },
  'Sudarshan Yellamaraju':      { dob: 'July 9, 2001', birthPlace: '', swing: '', college: '' },
  'Benjamin James':             { birthPlace: '', height: '', weight: '', swing: '' },
  'Ryuichi Oiwa':               { birthPlace: '', height: '', weight: '', college: '' },
  'Kevin Yu':                   { birthPlace: '', height: '', weight: '', college: '' },

  // ---- Missing 3 fields ----
  'Caleb Surratt':              { dob: 'March 16, 2004', height: '', weight: '' },
  'Jake Peacock':               { dob: '', height: '', weight: '' },
  'Greyson Leach':              { dob: '', height: '', weight: '' },
  'Robbie Higgins':             { dob: '', height: '', weight: '' },
  'Jayden Trey Schaper':        { height: '', weight: '', college: '' },
  'Matthew Jordan':             { height: '', weight: '', college: '' },
  'Laurie Canter':              { height: '', weight: '', college: '' },
  'Ugo Coussaud':               { height: '', weight: '', college: '' },
  'Angel Hidalgo Portillo':     { height: '', weight: '', college: '' },
  'Luke Clanton':               { height: '', weight: '', college: '' },
  'Jackson Van Paris':          { height: '', weight: '', swing: '' },
  'Spencer Tibbits':            { height: '', weight: '', swing: '' },
  'Rocco Paolo Repetto Taylor': { height: '', weight: '', swing: '' },
  'Jake Sollon':                { dob: '', birthPlace: '', swing: '' },

  // ---- Missing 2 fields ----
  'Johnny Keefer':              { dob: 'January 11, 2001', weight: '' },
  'Cooper Dossey':              { dob: '', swing: '' },
  'Manav Shah':                 { dob: 'April 13, 1992', birthPlace: '' },
  'Tom Kim':                    { weight: '', college: '' },
  'Matthieu Pavon':             { weight: '', college: '' },
  'Chandler Phillips':          { weight: '', swing: '' },
  'Cole Hammer':                { height: '', weight: '' },
  'Austin Eckroat':             { height: '', weight: '' },
  'Karl Vilips':                { height: '', weight: '' },
  'Danny Walker':               { birthPlace: '', swing: '' },
  'John VanDerLaan':            { birthPlace: '', swing: '' },
  'Jeffrey Kang':               { birthPlace: '', swing: '' },
  'Pontus Nyholm':              { birthPlace: '', swing: '' },

  // ---- Missing 1 field ----
  'Jackson Suber':              { dob: '' },
  'Robert MacIntyre':           { weight: '' },
  'Michael Brennan':            { weight: '' },
  'Neal Shipley':               { weight: '' },
  'Filippo Celli':              { weight: '' },
  'Marcelo Rozo':               { birthPlace: '' },
  'Nico Echavarria':            { swing: '' },
  'Pierceson Coody':            { swing: '' },
  'Davis Thompson':             { swing: '' },
  'Alejandro Tosti':            { swing: '' },
  'Carl Yuan':                  { swing: '' },
  'Patrick Fishburn':           { swing: '' },
  'Mac Meissner':               { swing: '' },

  // ---- College-only gaps (NOT stubbed) ----
  // These already display "*Did not attend college" automatically because the APIs
  // confirm no college. Only add a 'college' entry here if one of them ACTUALLY attended
  // college and is showing the note incorrectly:
  //   Rory McIlroy, Tommy Fleetwood, Akshay Bhatia, Min Woo Lee, Tyrrell Hatton,
  //   Joaquin Niemann, Jason Day, Cameron Smith, Nicolai Hojgaard, Ryan Fox,
  //   Emiliano Grillo, Ryo Hisatsune, Justin Rose, Aaron Rai, Kristoffer Reitan,
  //   John Parry, Adrien Saddier, Lucas Herbert, Nathan Kimsey, Hennie Du Plessis,
  //   Niklas Norgaard Moller, Taihei Sato, Tony Finau, Zecheng Dou, Kensei Hirata,
  //   Takumi Kanaya
};
