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
  'A.J. Ewart':                 { dob: 'May 7, 1999', birthPlace: 'Coquitlam, Canada', height: `6'1"`, weight: '175 lbs', swing: 'Right', college: '' },
  'Davis Chatfield':            { dob: 'May 28, 1999', birthPlace: 'Attleboro, Massachusetts', height: `6'0"`, weight: '180 lbs', swing: 'Right', college: '' },

  // ---- Missing 4–5 fields ----
  'Zach Bauchou':               { birthPlace: 'Forest, Virginia', height: `5'11"`, weight: '170 lbs', swing: 'Right', college: '' },
  'Sudarshan Yellamaraju':      { dob: 'July 9, 2001', birthPlace: 'Visakhapatnam, India', swing: 'Right', college: '' },
  'Benjamin James':             { birthPlace: 'Milford, Connecticut', height: `6'0"`, weight: '172 lbs', swing: 'Right' },
  'Ryuichi Oiwa':               { birthPlace: 'Toyohashi, Japan', height: `5'11"`, weight: '202 lbs', college: '' },
  'Kevin Yu':                   { birthPlace: 'Taoyuan, Taiwan', height: `5'10"`, weight: '165 lbs', college: '' },

  // ---- Missing 3 fields ----
  'Caleb Surratt':              { dob: 'March 16, 2004', height: `6'3"`, weight: '190 lbs' },
  'Jake Peacock':               { dob: 'June 20, 2003', height: `6'2"`, weight: '180 lbs' },
  'Greyson Leach':              { dob: '', height: `6'2"`, weight: '180 lbs' },
  'Robbie Higgins':             { dob: 'August 27, 2003', height: `5'10"`, weight: '190 lbs' },
  'Jayden Trey Schaper':        { height: `6'1"`, weight: '176 lbs', college: '' },
  'Matthew Jordan':             { height: `6'0"`, weight: '170 lbs', college: '' },
  'Laurie Canter':              { height: `6'3"`, weight: '187 lbs', college: '' },
  'Ugo Coussaud':               { height: `6'2"`, weight: '187 lbs', college: '' },
  'Angel Hidalgo Portillo':     { height: `5'10"`, weight: '165 lbs', college: '' },
  'Luke Clanton':               { height: `6'1"`, weight: '170 lbs', college: '' },
  'Jackson Van Paris':          { height: `6'3"`, weight: '190 lbs', swing: 'Right' },
  'Spencer Tibbits':            { height: `6'2"`, weight: '155 lbs', swing: 'Right' },
  'Rocco Paolo Repetto Taylor': { height: `5'11"`, weight: '', swing: 'Right' },
  'Jake Sollon':                { dob: 'February 18, 1998', birthPlace: 'Venetia, Pennsylvania', swing: 'Right' },

  // ---- Missing 2 fields ----
  'Johnny Keefer':              { dob: 'January 11, 2001', weight: '175 lbs' },
  'Cooper Dossey':              { dob: 'March 24, 1998', swing: 'Right' },
  'Manav Shah':                 { dob: 'April 13, 1992', birthPlace: 'Bakersfield, California' },
  'Tom Kim':                    { weight: '187 lbs', college: '' },
  'Matthieu Pavon':             { weight: '176 lbs', college: '' },
  'Chandler Phillips':          { weight: '175 lbs', swing: 'Right' },
  'Cole Hammer':                { height: `6'0"`, weight: '170 lbs' },
  'Austin Eckroat':             { height: `5'11"`, weight: '165 lbs' },
  'Karl Vilips':                { height: `6'0"`, weight: '170 lbs' },
  'Danny Walker':               { birthPlace: 'Bradenton, Florida', swing: 'Right' },
  'John VanDerLaan':            { birthPlace: 'Southbury, Connecticut', swing: 'Right' },
  'Jeffrey Kang':               { birthPlace: 'Los Angeles, California', swing: 'Right' },
  'Pontus Nyholm':              { birthPlace: 'Gävle, Sweden', swing: 'Right' },

  // ---- Missing 1 field ----
  'Jackson Suber':              { dob: 'October 18, 1999' },
  'Robert MacIntyre':           { weight: '163 lbs' },
  'Michael Brennan':            { weight: '175 lbs' },
  'Neal Shipley':               { weight: '205 lbs' },
  'Filippo Celli':              { weight: '170 lbs' },
  'Marcelo Rozo':               { birthPlace: 'Bogotá, Colombia' },
  'Nico Echavarria':            { swing: 'Right' },
  'Pierceson Coody':            { swing: 'Right' },
  'Davis Thompson':             { swing: 'Right' },
  'Alejandro Tosti':            { swing: 'Right' },
  'Carl Yuan':                  { swing: 'Right' },
  'Patrick Fishburn':           { swing: 'Right' },
  'Mac Meissner':               { swing: 'Right' },

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
