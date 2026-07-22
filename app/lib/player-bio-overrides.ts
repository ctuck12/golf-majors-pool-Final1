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
//   college     e.g. 'Texas'  — fill if the player actually attended college.
//   noCollege   true  — show "*Did not attend college". Use this for players whose
//               DOB we set via override (so the API never confirmed it for us); without
//               it their College shows a bare "—". Don't set both college and noCollege.

export type BioOverride = Partial<{
  height: string;
  weight: string;
  dob: string;
  birthPlace: string;
  swing: string; // 'Right' | 'Left'
  college: string;
  noCollege: boolean;
  turnedPro: number; // year, e.g. 2012
}>;

// Checklist of players with bio gaps as of the last audit, ordered by how much is missing.
// Fill in the empty strings; delete fields you can't find. The 2 "all six" players aren't
// on ESPN or PGA Tour, so everything must be entered manually.
export const PLAYER_BIO_OVERRIDES: Record<string, BioOverride> = {
  // ---- Missing all six (no record on either API) ----
  'A.J. Ewart':                 { dob: 'May 7, 1999', birthPlace: 'Coquitlam, Canada', height: `6'1"`, weight: '175 lbs', swing: 'Right', college: 'Barry University' },
  'Davis Chatfield':            { dob: 'May 28, 1999', birthPlace: 'Attleboro, Massachusetts', height: `6'0"`, weight: '180 lbs', swing: 'Right', college: 'Notre Dame' },

  // ---- Missing 4–5 fields ----
  'Zach Bauchou':               { birthPlace: 'Forest, Virginia', height: `5'11"`, weight: '170 lbs', swing: 'Right', college: 'Oklahoma State' },
  'Sudarshan Yellamaraju':      { dob: 'July 9, 2001', birthPlace: 'Visakhapatnam, India', swing: 'Left', noCollege: true },
  'Ben James':                  { birthPlace: 'Milford, Connecticut', height: `6'0"`, weight: '172 lbs', swing: 'Right' },
  'Ryuichi Oiwa':               { birthPlace: 'Toyohashi, Japan', height: `5'11"`, weight: '202 lbs', college: '' },
  'Kevin Yu':                   { birthPlace: 'Taoyuan, Taiwan', height: `5'10"`, weight: '165 lbs', college: 'Arizona State' },

  // ---- Missing 3 fields ----
  'Caleb Surratt':              { dob: 'March 16, 2004', height: `6'3"`, weight: '190 lbs' },
  'Jake Peacock':               { dob: 'June 20, 2003', height: `6'2"`, weight: '180 lbs' },
  'Greyson Leach':              { dob: 'August 28, 2002', height: `6'2"`, weight: '180 lbs' },
  'Robbie Higgins':             { dob: 'August 27, 2003', height: `5'10"`, weight: '190 lbs' },
  'Jayden Trey Schaper':        { height: `6'1"`, weight: '176 lbs', college: '' },
  'Matthew Jordan':             { height: `6'0"`, weight: '170 lbs', college: '' },
  'Laurie Canter':              { height: `6'3"`, weight: '187 lbs', college: '' },
  'Ugo Coussaud':               { height: `6'2"`, weight: '187 lbs', college: 'Laval University' },
  'Angel Hidalgo Portillo':     { height: `5'10"`, weight: '165 lbs', college: '' },
  'Luke Clanton':               { height: `6'1"`, weight: '170 lbs', college: 'Florida State' },
  'Jackson Van Paris':          { height: `6'3"`, weight: '190 lbs', swing: 'Right' },
  'Spencer Tibbits':            { height: `6'2"`, weight: '155 lbs', swing: 'Right' },
  'Rocco Paolo Repetto Taylor': { height: `5'11"`, weight: '180 lbs', swing: 'Right' },
  'Jake Sollon':                { dob: 'February 18, 1998', birthPlace: 'Venetia, Pennsylvania', swing: 'Right' },

  // ---- 2026 Open field players missing a flag/bio (researched July 2026) ----
  'Alejandro De Castro Piera':  { birthPlace: 'Barcelona, Spain', swing: 'Left', college: 'Long Beach State' },
  'Tim Wiedemeyer':             { dob: 'January 14, 2005', birthPlace: 'Munich, Germany', height: `6'0"`, college: 'Texas Tech' },
  'Scott Vincent':              { dob: 'May 20, 1992', birthPlace: 'Harare, Zimbabwe', swing: 'Right', college: 'Virginia Tech', turnedPro: 2015 },

  // ---- Missing 2 fields ----
  'Jordan Smith':               { birthPlace: 'Bath, England', swing: 'Right' },
  'Dan Brown':                  { birthPlace: 'Northallerton, England', weight: '190 lbs', swing: 'Right' },

  // ---- 2026 Open field additions (researched July 2026) ----
  'Joe Dean':                   { dob: 'June 23, 1994', birthPlace: 'Sheffield, England', height: `6'0"`, weight: '180 lbs', noCollege: true },
  // Australian DP World Tour pro (ESPN 5119687) — NOT the South African-born USC amateur
  // (ESPN 5337673), whose data was mistakenly used here before.
  'Jack Buchanan':              { dob: 'April 1, 2002', birthPlace: 'Scotland', turnedPro: 2023, noCollege: true },
  'Stuart Grehan':              { birthPlace: 'Tullamore, Ireland', college: 'Maynooth University' },
  'Lev Grinberg':               { dob: 'November 17, 2007', birthPlace: 'Kyiv, Ukraine' },
  'David Howard':               { birthPlace: 'Cork, Ireland', noCollege: true },
  'Nevill Ruiter':              { birthPlace: 'Bergen, Netherlands', height: `6'5"`, college: 'College of Charleston' },
  'Jose Luis Ballester Barrio': { dob: 'August 18, 2003', birthPlace: 'Castellón, Spain', height: `6'0"`, weight: '180 lbs', college: 'Arizona State' },
  'Martin Couvra':              { dob: 'January 17, 2003', birthPlace: 'Toulon, France', noCollege: true },
  'Francesco Laporta':          { dob: 'October 10, 1990', birthPlace: 'Castellana Grotte, Italy', height: `5'9"`, weight: '154 lbs' },
  'Antoine Rozner':             { dob: 'February 12, 1993', birthPlace: 'Paris, France', height: `6'0"`, weight: '202 lbs', college: 'Missouri-Kansas City' },
  'Dan Bradbury':               { dob: 'July 26, 1999', birthPlace: 'Wakefield, England', height: `6'2"`, college: 'Florida State' },
  'MJ Daffue':                  { dob: 'January 13, 1989', birthPlace: 'Pretoria, South Africa', height: `6'2"`, weight: '210 lbs', swing: 'Right', college: 'Lamar' },
  'Alistair Docherty':          { dob: 'March 20, 1994', birthPlace: 'Saint John, Canada', height: `5'10"`, weight: '175 lbs', college: 'Chico State' },
  'Kazuma Kobori':              { dob: 'October 25, 2001', birthPlace: 'Karuizawa, Japan', height: `5'8"`, swing: 'Right' },
  'Frederic Lacroix':           { dob: 'February 23, 1995', birthPlace: 'Paris, France', height: `6'0"`, weight: '161 lbs', swing: 'Right', college: 'Paris Dauphine University' },
  'Joakim Lagergren':           { dob: 'November 15, 1991', birthPlace: 'Stockholm, Sweden', height: `5'9"`, weight: '139 lbs', swing: 'Right' },
  'Shaun Norris':               { dob: 'May 14, 1982', birthPlace: 'Johannesburg, South Africa', height: `6'2"`, weight: '181 lbs', swing: 'Right' },
  'Henrik Stenson':             { dob: 'April 5, 1976', birthPlace: 'Gothenburg, Sweden', height: `6'2"`, weight: '190 lbs', swing: 'Right', noCollege: true },
  'Sam Bairstow':               { dob: 'August 12, 1998', birthPlace: 'Sheffield, England', height: `6'1"`, swing: 'Left' },
  'Jeongwoo Ham':               { dob: 'August 30, 1994', birthPlace: 'Cheonan, South Korea', height: `5'7"`, weight: '198 lbs', swing: 'Right', college: 'Sungkyunkwan University' },
  'Naoyuki Kataoka':            { dob: 'December 28, 1997', birthPlace: 'Hokkaido, Japan', height: `5'6"`, weight: '148 lbs', swing: 'Right', college: 'Tohoku Fukushi University' },
  'Ryutaro Nagano':             { dob: 'May 6, 1988', birthPlace: 'Kumamoto, Japan', college: 'Tohoku Fukushi University' },
  'Matthew Southgate':          { dob: 'October 3, 1988', birthPlace: 'Southend-on-Sea, England', height: `6'4"`, weight: '209 lbs', college: 'Logan College' },
  'Austen Truslow':             { dob: 'February 13, 1996', birthPlace: 'Fort Lauderdale, Florida', height: `6'5"`, weight: '205 lbs', college: 'Rollins College' },
  'Jiho Yang':                  { dob: 'January 14, 1989', height: `6'0"`, weight: '165 lbs' },
  'Ren Yonezawa':               { dob: 'July 23, 1999', birthPlace: 'Morioka, Japan', height: `5'7"`, swing: 'Right', college: 'Tohoku Fukushi University' },
  'Matthew Baldwin':            { dob: 'February 26, 1986', birthPlace: 'Southport, England' },
  'Tiger Christensen':          { dob: 'August 19, 2003', birthPlace: 'Hamburg, Germany', height: `6'2"`, college: 'Arizona' },
  'Darren Clarke':              { dob: 'August 14, 1968', birthPlace: 'Dungannon, Northern Ireland', height: `6'2"`, weight: '214 lbs', swing: 'Right', college: 'Wake Forest' },
  'David Duval':                { dob: 'November 9, 1971', birthPlace: 'Jacksonville, Florida', height: `6'0"`, weight: '180 lbs', swing: 'Right', college: 'Georgia Tech' },
  'Cameron John':               { dob: 'April 27, 1999', birthPlace: 'Melbourne, Australia', height: `6'3"`, weight: '183 lbs' },
  'Jack McDonald':              { dob: 'February 12, 1993', birthPlace: 'Kilmarnock, Scotland', college: 'Stirling' },
  'Marcus Plunkett':            { birthPlace: 'St. Louis Park, Minnesota', college: 'Army (West Point)' },
  'Baard Bjoernevik Skogen':    { birthPlace: 'Sveio, Norway', height: `6'4"`, college: 'Texas Tech' },
  'Thomas Sloman':              { birthPlace: 'Taunton, England', college: 'Hartpury College' },
  'Johnny Keefer':              { dob: 'January 11, 2001', weight: '175 lbs' },
  'Cooper Dossey':              { dob: 'March 24, 1998', swing: 'Right' },
  'Manav Shah':                 { dob: 'April 13, 1992', birthPlace: 'Bakersfield, California' },
  'Tom Kim':                    { weight: '187 lbs', college: '' },
  'Matthieu Pavon':             { weight: '176 lbs', college: '' },
  'Chandler Phillips':          { weight: '175 lbs', swing: 'Right' },
  'Cole Hammer':                { height: `6'0"`, weight: '170 lbs' },
  'Daniel Hillier':             { height: `6'1"`, weight: '170 lbs' },
  'Austin Eckroat':             { height: `5'11"`, weight: '165 lbs' },
  'Karl Vilips':                { height: `6'0"`, weight: '170 lbs' },
  'Danny Walker':               { birthPlace: 'Bradenton, Florida', swing: 'Right' },
  'John VanDerLaan':            { birthPlace: 'Southbury, Connecticut', swing: 'Right' },
  'Jeffrey Kang':               { birthPlace: 'Los Angeles, California', swing: 'Right' },
  'Pontus Nyholm':              { birthPlace: 'Gävle, Sweden', swing: 'Right' },

  // ---- Missing 1 field ----
  'Jackson Suber':              { dob: 'October 18, 1999' },
  'Robert MacIntyre':           { weight: '163 lbs' },
  'Mikael Lindberg':            { weight: '198 lbs' },
  'Daniel Brown':               { height: `6'3"` },
  'Elvis Smylie':               { height: `6'0"`, weight: '157 lbs' },
  'Casey Jarvis':               { weight: '181 lbs' },
  'Garrick Higgo':              { swing: 'Left', college: 'UNLV' },
  'Joe Highsmith':              { swing: 'Left' },
  'Thomas Detry':               { weight: '155 lbs' },
  'Ricky Castillo':             { birthPlace: 'Yorba Linda, California', swing: 'Right' },
  'Steven Fisk':                { birthPlace: 'Atlanta, Georgia', swing: 'Right' },
  'Ryan Vermeer':               { birthPlace: 'Spencer, Iowa' },
  'Michael Thorbjornsen':       { height: `6'0"`, weight: '176 lbs', swing: 'Right' },
  'Travis Smyth':               { birthPlace: 'Shellharbour, New South Wales', height: `5'10"`, weight: '165 lbs', swing: 'Right' },
  'Angel Ayora':                { birthPlace: 'Málaga, Spain', dob: 'October 3, 2004', height: `6'0"`, weight: '172 lbs' },
  'Tyler Collet':               { dob: 'August 23, 1995', height: `5'9"`, weight: '150 lbs', swing: 'Right' },
  'Garrett Sapp':               { birthPlace: 'Cerritos, California' },
  'Jared Jones':                { swing: 'Right' },
  'Ian Holt':                   { college: 'Kent State', birthPlace: 'Stow, Ohio', swing: 'Right' },
  'Timothy Wiseman':            { birthPlace: 'Corydon, Indiana', height: `6'0"`, weight: '190 lbs' },
  'Michael Kartrude':           { birthPlace: 'West Palm Beach, Florida', swing: 'Right' },
  'Mark Geddes':                { birthPlace: 'Moreton, England', college: 'Grand Canyon' },
  'Jesse Droemer':              { swing: 'Right' },
  'Braden Shattuck':            { swing: 'Right' },
  'Ryan Lenahan':               { birthPlace: 'Grosse Pointe Shores, Michigan', swing: 'Right', college: 'Nebraska' },
  'Francisco Bide':             { birthPlace: 'Buenos Aires, Argentina', height: `6'3"`, swing: 'Right', college: 'Georgia College' },
  'Bryce Fisher':               { college: 'Scottsdale Community College' },
  'Derek Berg':                 { college: 'Washington', height: `5'10"`, weight: '170 lbs', swing: 'Right' },
  'Chris Gabriele':             { college: 'Clemson', turnedPro: 2019, swing: 'Right' },
  'Paul McClure':               { college: 'North Alabama', dob: 'November 1, 1991', height: `5'11"`, swing: 'Right' },
  'Zach Haynes':                { college: 'UT Martin', birthPlace: 'Smyrna, Tennessee', swing: 'Left', dob: 'November 9, 1995', turnedPro: 2018 },
  'Matthew Robles':             { height: `5'7"` },
  'Arni Sveinsson':             { height: `6'0"` },
  'Jackson Ormond':             { college: 'Florida', height: `5'11"`, weight: '155 lbs' },
  'Vaughn Harber':              { height: `6'3"` },
  'Ethan Fang':                 { height: `6'0"`, weight: '145 lbs' },
  'Jack Schoenberger':          { height: `5'10"`, turnedPro: 2026, dob: 'May 27, 2003', swing: 'Right' },
  'Jackson Koivun':             { dob: 'May 23, 2005', turnedPro: 2026 },
  'Miles Russell':              { dob: 'November 1, 2008' },
  'S.H. Kim':                   { birthPlace: 'Changwon, South Korea', swing: 'Right', turnedPro: 2017 },
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
  'Christiaan Bezuidenhout':    { swing: 'Right' },
  'Ben Kern':                   { swing: 'Right' },

  // ---- College (players who DID attend — clears the auto "Did not attend college" note) ----
  'Takumi Kanaya':              { college: 'Tohoku Fukushi University' },
  'Ryan Fox':                   { college: 'University of Waikato' },
  'Kristoffer Reitan':          { college: 'Texas' },
  'Austin Hurt':                { dob: 'February 21, 1989', birthPlace: 'Seattle, Washington', height: `5'8"`, weight: '155 lbs', swing: 'Right', college: 'Washington State', turnedPro: 2012 },
  'Kota Kaneko':                { dob: 'September 4, 2002', birthPlace: 'Aichi, Japan', swing: 'Right', noCollege: true },
  'Kurt Kitayama':              { college: 'UNLV' },
  'Adam Scott':                 { college: 'UNLV' },

  // ---- College-only gaps (NOT stubbed) ----
  // These already display "*Did not attend college" automatically because the APIs
  // confirm no college. Only add a 'college' entry here if one of them ACTUALLY attended
  // college and is showing the note incorrectly:
  //   Rory McIlroy, Tommy Fleetwood, Akshay Bhatia, Min Woo Lee, Tyrrell Hatton,
  //   Joaquin Niemann, Jason Day, Cameron Smith, Nicolai Hojgaard, Emiliano Grillo,
  //   Ryo Hisatsune, Justin Rose, Aaron Rai, John Parry, Adrien Saddier,
  //   Lucas Herbert, Nathan Kimsey, Hennie Du Plessis, Niklas Norgaard Moller,
  //   Taihei Sato, Tony Finau, Zecheng Dou, Kensei Hirata
};
