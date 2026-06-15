// IDs are frozen once assigned — existing saved rosters reference them by number. Do not reuse removed IDs.
// Retired IDs (not in 2026 US Open field):
//   11, 26, 34, 39, 46, 52, 65, 67, 70, 71, 73, 76, 77, 80, 81, 82, 83, 84, 85, 86, 88, 89,
//   91, 92, 95, 96, 97, 99, 100, 101, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
//   115, 117, 118, 120, 122, 123, 124, 125, 127, 128, 129, 130, 131, 132, 133, 134, 135, 137,
//   138, 139, 140, 141, 142, 143, 144, 145, 147, 148, 149, 152, 153, 154, 155, 156, 157, 160,
//   161, 162, 163, 164, 165, 166, 167, 168, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179,
//   180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 194, 195, 196

export const PLAYER_POOL_WITH_PGA_IDS = [
  // $11,900
  { id:   1, name: 'Scottie Scheffler',            pgaTourId: 46046, defaultOdds: '$11,900', worldRank:   1 },
  // $10,200
  { id:   2, name: 'Rory McIlroy',                 pgaTourId: 28237, defaultOdds: '$10,200', worldRank:   2 },
  // $9,900
  { id:  16, name: 'Jon Rahm',                     pgaTourId: 46970, defaultOdds: '$9,900',  worldRank:   8 },
  // $9,100
  { id:   3, name: 'Xander Schauffele',            pgaTourId: 48081, defaultOdds: '$9,100',  worldRank:  12 },
  { id:  23, name: 'Cameron Young',                pgaTourId: 57366, defaultOdds: '$9,100',  worldRank:   3 },
  { id:  20, name: 'Matthew Fitzpatrick',          pgaTourId: 40098, defaultOdds: '$9,100',  worldRank:   4 },
  // $9,000
  { id:   6, name: 'Tommy Fleetwood',              pgaTourId: 30911, defaultOdds: '$9,000',  worldRank:   6 },
  // $8,900
  { id:   5, name: 'Ludvig Aberg',                 pgaTourId: 52955, defaultOdds: '$8,900',  worldRank:  13 },
  // $8,600
  { id:  15, name: 'Bryson DeChambeau',            pgaTourId: 47959, defaultOdds: '$8,600',  worldRank:  32 },
  // $8,300
  { id:   9, name: 'Brooks Koepka',                pgaTourId: 36689, defaultOdds: '$8,300',  worldRank: 110 },
  // $8,200
  { id:  29, name: 'Russell Henley',               pgaTourId: 34098, defaultOdds: '$8,200',  worldRank:   5 },
  // $8,100
  { id:  25, name: 'Sam Burns',                    pgaTourId: 47504, defaultOdds: '$8,100',  worldRank:  30 },
  { id:  24, name: 'Wyndham Clark',                pgaTourId: 51766, defaultOdds: '$8,100',  worldRank:  34 },
  { id:  21, name: 'Tyrrell Hatton',               pgaTourId: 34363, defaultOdds: '$8,100',  worldRank:  21, photoUrl: 'https://pga-tour-res.cloudinary.com/image/upload/c_fill,d_headshots_default.png,f_auto,g_north,h_280,q_auto,w_280/headshots_34363.png' },
  { id:   4, name: 'Collin Morikawa',              pgaTourId: 50525, defaultOdds: '$8,100',  worldRank:  10 },
  // $8,000
  { id:  37, name: 'Si Woo Kim',                   pgaTourId: 37455, defaultOdds: '$8,000',  worldRank:  18 },
  // $7,900
  { id:  18, name: 'Justin Thomas',                pgaTourId: 33448, defaultOdds: '$7,900',  worldRank:  16 },
  { id:  61, name: 'Justin Rose',                  pgaTourId: 22405, defaultOdds: '$7,900',  worldRank:   7 },
  { id:  90, name: 'Patrick Reed',                 pgaTourId: 34360, defaultOdds: '$7,900',  worldRank:  27 },
  { id:  50, name: 'Christopher Gotterup',         pgaTourId: 59095, defaultOdds: '$7,900',  worldRank:  11 },
  { id:  17, name: 'Viktor Hovland',               pgaTourId: 46717, defaultOdds: '$7,900',  worldRank:  28 },
  { id:   7, name: 'Patrick Cantlay',              pgaTourId: 35450, defaultOdds: '$7,900',  worldRank:  36 },
  // $7,700
  { id:  53, name: 'J.J. Spaun',                   pgaTourId: 39324, defaultOdds: '$7,700',  worldRank:   9 },
  // $7,600
  { id:   8, name: 'Hideki Matsuyama',             pgaTourId: 32839, defaultOdds: '$7,600',  worldRank:  24 },
  { id:  19, name: 'Joaquin Niemann',              pgaTourId: 45486, defaultOdds: '$7,600',  worldRank:  80 },
  // $7,500
  { id:  22, name: 'Robert MacIntyre',             pgaTourId: 52215, defaultOdds: '$7,500',  worldRank:  17 },
  { id:  10, name: 'Jordan Spieth',                pgaTourId: 34046, defaultOdds: '$7,500',  worldRank:  51 },
  { id:  12, name: 'Min Woo Lee',                  pgaTourId: 37378, defaultOdds: '$7,500',  worldRank:  35 },
  { id:  40, name: 'Ben Griffin',                  pgaTourId: 54591, defaultOdds: '$7,500',  worldRank:  15 },
  { id:  30, name: 'Shane Lowry',                  pgaTourId: 33204, defaultOdds: '$7,500',  worldRank:  44 },
  { id:  45, name: 'Maverick McNealy',             pgaTourId: 46442, defaultOdds: '$7,500',  worldRank:  37 },
  // $7,400
  { id:  49, name: 'Kurt Kitayama',                pgaTourId: 48117, defaultOdds: '$7,400',  worldRank:  31 },
  { id:  94, name: 'Harris English',               pgaTourId: 34099, defaultOdds: '$7,400',  worldRank:  22 },
  // $7,300
  { id:  55, name: 'Adam Scott',                   pgaTourId: 24502, defaultOdds: '$7,300',  worldRank:  49 },
  { id: 126, name: 'Aaron Rai',                    pgaTourId: 46414, defaultOdds: '$7,300',  worldRank:  14 },
  { id:  58, name: 'Bud Cauley',                   pgaTourId: 34021, defaultOdds: '$7,300',  worldRank:  40 },
  // $7,200
  { id: 116, name: 'Kristoffer Reitan',            pgaTourId: 49855, defaultOdds: '$7,200',  worldRank:  26 },
  { id: 114, name: 'Alex Fitzpatrick',             pgaTourId: 55721, defaultOdds: '$7,200',  worldRank:  69 },
  { id:  78, name: 'Ryan Gerard',                  pgaTourId: 59018, defaultOdds: '$7,200',  worldRank:  23 },
  { id:  54, name: 'Jake Knapp',                   pgaTourId: 47420, defaultOdds: '$7,200',  worldRank:  43 },
  { id:  31, name: 'Sepp Straka',                  pgaTourId: 49960, defaultOdds: '$7,200',  worldRank:  19 },
  { id:  38, name: 'Nicolai Hojgaard',             pgaTourId: 52453, defaultOdds: '$7,200',  worldRank:  33 },
  { id:  72, name: 'Alex Smalley',                 pgaTourId: 46340, defaultOdds: '$7,200',  worldRank:  42 },
  { id: 146, name: 'David Puig',                   pgaTourId: 61193, defaultOdds: '$7,200',  worldRank: 109, photoUrl: 'https://cdn.sanity.io/images/2guez6v8/prd/c46890fb030a902de7f235b2bddf32006b860199-2747x2622.png?bg=ffffff&fit=crop&w=280&h=350' },
  // $7,100
  { id:  66, name: 'Gary Woodland',                pgaTourId: 31323, defaultOdds: '$7,100',  worldRank:  45 },
  { id:  14, name: 'Akshay Bhatia',                pgaTourId: 56630, defaultOdds: '$7,100',  worldRank:  29 },
  { id:  28, name: 'Cameron Smith',                pgaTourId: 35891, defaultOdds: '$7,100',  worldRank: 136 },
  { id:  47, name: 'J.T. Poston',                  pgaTourId: 49771, defaultOdds: '$7,100',  worldRank:  38 },
  { id:  35, name: 'Rickie Fowler',                pgaTourId: 32102, defaultOdds: '$7,100',  worldRank:  41 },
  { id:  48, name: 'Alex Noren',                   pgaTourId: 27349, defaultOdds: '$7,100',  worldRank:  20 },
  // $7,000
  { id:  36, name: 'Keegan Bradley',               pgaTourId: 33141, defaultOdds: '$7,000',  worldRank:  39 },
  { id:  60, name: 'Jacob Bridgeman',              pgaTourId: 60004, defaultOdds: '$7,000',  worldRank:  25 },
  { id:  27, name: 'Jason Day',                    pgaTourId: 28089, defaultOdds: '$7,000',  worldRank:  47 },
  { id:  43, name: 'Ryan Fox',                     pgaTourId: 29936, defaultOdds: '$7,000',  worldRank:  55 },
  // $6,900
  { id: 158, name: 'Keith Mitchell',               pgaTourId: 39546, defaultOdds: '$6,900',  worldRank: 100 },
  { id: 102, name: 'Dustin Johnson',               pgaTourId: 30925, defaultOdds: '$6,900',  worldRank: 245 },
  { id:  57, name: 'Harry Hall',                   pgaTourId: 57975, defaultOdds: '$6,900',  worldRank:  66 },
  // $6,800
  { id: 121, name: 'Daniel Berger',                pgaTourId: 40026, defaultOdds: '$6,800',  worldRank:  46 },
  { id:  33, name: 'Corey Conners',                pgaTourId: 39997, defaultOdds: '$6,800',  worldRank:  56 },
  { id:  13, name: 'Sahith Theegala',              pgaTourId: 51634, defaultOdds: '$6,800',  worldRank:  83 },
  { id:  98, name: 'Sungjae Im',                   pgaTourId: 39971, defaultOdds: '$6,800',  worldRank:  74 },
  { id: 193, name: 'Sudarshan Yellamaraju',        pgaTourId: 99999, defaultOdds: '$6,800',  worldRank:  96 },
  { id:  42, name: 'Nick Taylor',                  pgaTourId: 25493, defaultOdds: '$6,800',  worldRank:  63 },
  // $6,700
  { id: 197, name: 'Joohyung Kim',                 pgaTourId: 59042, defaultOdds: '$6,700',  worldRank: 141 },
  { id:  32, name: 'Brian Harman',                 pgaTourId: 27644, defaultOdds: '$6,700',  worldRank:  59 },
  { id: 198, name: 'Lucas Herbert',                pgaTourId: 99999, defaultOdds: '$6,700',  worldRank:  88 },
  // $6,600
  { id: 119, name: 'Pierceson Coody',              pgaTourId: 59836, defaultOdds: '$6,600',  worldRank:  58 },
  { id: 199, name: 'Davis Thompson',               pgaTourId: 57626, defaultOdds: '$6,600',  worldRank: 138 },
  { id:  44, name: 'Ryo Hisatsune',                pgaTourId: 51287, defaultOdds: '$6,600',  worldRank:  62 },
  { id: 200, name: 'Jackson Suber',                pgaTourId: 99999, defaultOdds: '$6,600',  worldRank: 128 },
  { id:  51, name: 'Max Greyserman',               pgaTourId: 51977, defaultOdds: '$6,600',  worldRank:  68 },
  // $6,500
  { id:  74, name: 'Samuel Stevens',               pgaTourId: 55893, defaultOdds: '$6,500',  worldRank:  54 },
  { id:  75, name: 'Matthew McCarty',              pgaTourId: 59141, defaultOdds: '$6,500',  worldRank:  53 },
  { id:  59, name: 'Michael Kim',                  pgaTourId: 39975, defaultOdds: '$6,500',  worldRank:  50 },
  { id:  68, name: 'Andrew Novak',                 pgaTourId: 51997, defaultOdds: '$6,500',  worldRank:  61 },
  { id: 201, name: 'Carlos Ortiz',                 pgaTourId: 32706, defaultOdds: '$6,500',  worldRank: 188 },
  { id: 202, name: 'Jayden Trey Schaper',          pgaTourId: 99999, defaultOdds: '$6,500',  worldRank:  70 },
  { id:  93, name: 'Michael Brennan',              pgaTourId: 61522, defaultOdds: '$6,500',  worldRank:  60 },
  { id:  62, name: 'Andrew Putnam',                pgaTourId: 34256, defaultOdds: '$6,500',  worldRank:  85 },
  { id: 203, name: 'Benjamin James',               pgaTourId: 99999, defaultOdds: '$6,500',  worldRank: 999 },
  // $6,400
  { id: 150, name: 'John Keefer',                  pgaTourId: 63454, defaultOdds: '$6,400',  worldRank:  75 },
  { id:  64, name: 'Chris Kirk',                   pgaTourId: 30926, defaultOdds: '$6,400',  worldRank: 106 },
  { id:  69, name: 'Matthias Schmid',              pgaTourId: 48867, defaultOdds: '$6,400',  worldRank: 263 },
  { id: 136, name: 'Billy Horschel',               pgaTourId: 29420, defaultOdds: '$6,400',  worldRank: 135 },
  { id: 151, name: 'Max McGreevy',                 pgaTourId: 51950, defaultOdds: '$6,400',  worldRank:  99 },
  { id:  41, name: 'Emiliano Grillo',              pgaTourId: 31646, defaultOdds: '$6,400',  worldRank: 116 },
  { id:  63, name: 'Patrick Rodgers',              pgaTourId: 36699, defaultOdds: '$6,400',  worldRank:  81 },
  { id:  79, name: 'William Mouw',                 pgaTourId: 63121, defaultOdds: '$6,400',  worldRank: 131 },
  { id:  56, name: 'Nicolas Echavarria',           pgaTourId: 51349, defaultOdds: '$6,400',  worldRank:  52 },
  { id: 159, name: 'John Parry',                   pgaTourId: 28723, defaultOdds: '$6,400',  worldRank: 102 },
  { id: 204, name: 'Nathan Kimsey',                pgaTourId: 99999, defaultOdds: '$6,400',  worldRank: 214 },
  { id: 205, name: 'Adrien Dumont De Chassart',    pgaTourId: 60874, defaultOdds: '$6,400',  worldRank: 168 },
  // $6,300
  { id: 206, name: 'Ben Kohles',                   pgaTourId: 39310, defaultOdds: '$6,300',  worldRank: 184 },
  { id: 207, name: 'Caleb Surratt',                pgaTourId: 60427, defaultOdds: '$6,300',  worldRank: 287 },
  // $6,200
  { id: 208, name: 'Laurie Canter',                pgaTourId: 99999, defaultOdds: '$6,200',  worldRank: 151 },
  { id: 209, name: 'Kevin Roy',                    pgaTourId: 99999, defaultOdds: '$6,200',  worldRank: 133 },
  { id: 210, name: 'Matthew Jordan',               pgaTourId: 99999, defaultOdds: '$6,200',  worldRank: 281 },
  { id: 211, name: 'Neal Shipley',                 pgaTourId: 61175, defaultOdds: '$6,200',  worldRank: 999 },
  { id: 212, name: 'Jimmy Stanger',                pgaTourId: 99999, defaultOdds: '$6,200',  worldRank: 338 },
  { id: 213, name: 'Cooper Dossey',                pgaTourId: 60079, defaultOdds: '$6,200',  worldRank: 230 },
  { id: 169, name: 'Adrien Saddier',               pgaTourId: 34371, defaultOdds: '$6,200',  worldRank: 115 },
  { id: 214, name: 'Zac Blair',                    pgaTourId: 30592, defaultOdds: '$6,200',  worldRank: 204 },
  { id: 215, name: 'Ugo Coussaud',                 pgaTourId: 60682, defaultOdds: '$6,200',  worldRank: 217 },
  { id: 216, name: 'Chandler Phillips',            pgaTourId: 60491, defaultOdds: '$6,200',  worldRank: 172 },
  // $6,100
  { id: 217, name: 'Cole Hammer',                  pgaTourId: 59454, defaultOdds: '$6,100',  worldRank: 363 },
  { id:  87, name: 'Padraig Harrington',           pgaTourId: 20766, defaultOdds: '$6,100',  worldRank: 546 },
  { id: 218, name: 'Niklas Norgaard Moller',       pgaTourId: 99999, defaultOdds: '$6,100',  worldRank: 275 },
  { id: 219, name: 'Peter Uihlein',                pgaTourId: 27399, defaultOdds: '$6,100',  worldRank: 181 },
  { id: 220, name: 'Hennie Du Plessis',            pgaTourId: 99999, defaultOdds: '$6,100',  worldRank: 186 },
  { id: 221, name: 'T.K. Kim',                     pgaTourId: 99999, defaultOdds: '$6,100',  worldRank: 999 },
  { id: 222, name: 'Ben Silverman',                pgaTourId: 47217, defaultOdds: '$6,100',  worldRank: 262 },
  { id: 223, name: 'Alejandro Tosti',              pgaTourId: 47354, defaultOdds: '$6,100',  worldRank: 364 },
  { id: 224, name: 'Dylan Wu',                     pgaTourId: 50860, defaultOdds: '$6,100',  worldRank: 386 },
  { id: 225, name: 'Taylor Montgomery',            pgaTourId: 50022, defaultOdds: '$6,100',  worldRank: 227 },
  { id: 226, name: 'Nick Hardy',                   pgaTourId: 48567, defaultOdds: '$6,100',  worldRank: 575 },
  { id: 227, name: 'Carl Yuan',                    pgaTourId: 59491, defaultOdds: '$6,100',  worldRank: 999 },
  // $6,000
  { id: 228, name: 'Graeme McDowell',              pgaTourId: 23108, defaultOdds: '$6,000',  worldRank: 950 },
  { id: 229, name: 'James Nicholas',               pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 286 },
  { id: 230, name: 'Harry Higgs',                  pgaTourId: 35606, defaultOdds: '$6,000',  worldRank: 356 },
  { id: 231, name: 'Taihei Sato',                  pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 403 },
  { id: 232, name: 'Angel Hidalgo Portillo',       pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 325 },
  { id: 233, name: 'Greyson Leach',                pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 999 },
  { id: 234, name: 'Marcelo Rozo',                 pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 534 },
  { id: 235, name: 'J.B. Holmes',                  pgaTourId: 25467, defaultOdds: '$6,000',  worldRank: 970 },
  { id: 236, name: 'Jake Peacock',                 pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 999 },
  { id: 237, name: 'Brandon Wu',                   pgaTourId: 48085, defaultOdds: '$6,000',  worldRank: 703 },
  { id: 238, name: 'Jake Sollon',                  pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 999 },
  { id: 239, name: 'Ryuichi Oiwa',                 pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 389 },
  { id: 240, name: 'Filippo Celli',                pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 438 },
  { id: 241, name: 'Kaito Onishi',                 pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 804 },
  { id: 242, name: 'Robbie Higgins',               pgaTourId: 99999, defaultOdds: '$6,000',  worldRank: 999 },
  // $5,900
  { id: 243, name: 'Jackson Van Paris',            pgaTourId: 99999, defaultOdds: '$5,900',  worldRank: 704 },
  { id: 244, name: 'Rocco Paolo Repetto Taylor',   pgaTourId: 99999, defaultOdds: '$5,900',  worldRank: 358 },
  { id: 245, name: 'Manav Shah',                   pgaTourId: 99999, defaultOdds: '$5,900',  worldRank: 997 },
  { id: 246, name: 'Spencer Tibbits',              pgaTourId: 99999, defaultOdds: '$5,900',  worldRank: 999 },
] as const;

export type PlayerPoolEntry = (typeof PLAYER_POOL_WITH_PGA_IDS)[number];
