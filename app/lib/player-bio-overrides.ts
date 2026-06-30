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
  'A.J. Ewart':                 { dob: 'May 7, 1999', birthPlace: 'Coquitlam, Canada', height: `6'1"`, weight: '', swing: '', college: '' },
  'Davis Chatfield':            { dob: 'May 28, 1999', birthPlace: 'Attleboro, Massachusetts', height: `6'0"`, weight: '', swing: '', college: '' },

  // ---- Missing 4–5 fields ----
  'Zach Bauchou':               { birthPlace: 'Forest, Virginia', height: `5'11"`, weight: '', swing: '', college: '' },
  'Sudarshan Yellamaraju':      { dob: 'July 9, 2001', birthPlace: 'Visakhapatnam, India', swing: '', college: '' },
  'Benjamin James':             { birthPlace: 'Milford, Connecticut', height: `6'0"`, weight: '', swing: '' },
  'Ryuichi Oiwa':               { birthPlace: 'Toyohashi, Japan', height: `5'11"`, weight: '', college: '' },
  'Kevin Yu':                   { birthPlace: 'Taoyuan, Taiwan', height: `5'10"`, weight: '', college: '' },

  // ---- Missing 3 fields ----
  'Caleb Surratt':              { dob: 'March 16, 2004', height: `6'3"`, weight: '' },
  'Jake Peacock':               { dob: 'June 20, 2003', height: `6'2"`, weight: '' },
  'Greyson Leach':              { dob: '', height: `6'2"`, weight: '' },
  'Robbie Higgins':             { dob: 'August 27, 2003', height: `5'10"`, weight: '' },
  'Jayden Trey Schaper':        { height: `6'1"`, weight: '', college: '' },
  'Matthew Jordan':             { height: `6'0"`, weight: '', college: '' },
  'Laurie Canter':              { height: `6'3"`, weight: '', college: '' },
  'Ugo Coussaud':               { height: `6'2"`, weight: '', college: '' },
  'Angel Hidalgo Portillo':     { height: `5'10"`, weight: '', college: '' },
  'Luke Clanton':               { height: `6'1"`, weight: '', college: '' },
  'Jackson Van Paris':          { height: `6'3"`, weight: '', swing: '' },
  'Spencer Tibbits':            { height: `6'2"`, weight: '', swing: '' },
  'Rocco Paolo Repetto Taylor': { height: `5'11"`, weight: '', swing: '' },
  'Jake Sollon':                { dob: 'February 18, 1998', birthPlace: 'Venetia, Pennsylvania', swing: '' },

  // ---- Missing 2 fields ----
  'Johnny Keefer':              { dob: 'January 11, 2001', weight: '' },
  'Cooper Dossey':              { dob: 'March 24, 1998', swing: '' },
  'Manav Shah':                 { dob: 'April 13, 1992', birthPlace: 'Bakersfield, California' },
  'Tom Kim':                    { weight: '', college: '' },
  'Matthieu Pavon':             { weight: '', college: '' },
  'Chandler Phillips':          { weight: '', swing: '' },
  'Cole Hammer':                { height: `6'0"`, weight: '' },
  'Austin Eckroat':             { height: `5'11"`, weight: '' },
  'Karl Vilips':                { height: `6'0"`, weight: '' },
  'Danny Walker':               { birthPlace: 'Bradenton, Florida', swing: '' },
  'John VanDerLaan':            { birthPlace: 'Southbury, Connecticut', swing: '' },
  'Jeffrey Kang':               { birthPlace: 'Los Angeles, California', swing: '' },
  'Pontus Nyholm':              { birthPlace: 'Gävle, Sweden', swing: '' },

  // ---- Missing 1 field ----
  'Jackson Suber':              { dob: 'October 18, 1999' },
  'Robert MacIntyre':           { weight: '' },
  'Michael Brennan':            { weight: '' },
  'Neal Shipley':               { weight: '' },
  'Filippo Celli':              { weight: '' },
  'Marcelo Rozo':               { birthPlace: 'Bogotá, Colombia' },
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
