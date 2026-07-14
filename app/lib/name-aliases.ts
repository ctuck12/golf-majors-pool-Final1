// Salary pick lists, field lists, and score feeds sometimes label a player with their FULL first name
// while the pool uses a shortened/known form — e.g. "Benjamin James" vs "Ben James", "Joohyung Kim" vs
// "Tom Kim", "John Keefer" vs "Johnny Keefer". Without this map, name matching treats them as different
// players, so a salary upload creates a duplicate (and attaches the salary to the dataless duplicate
// instead of the real pool player). Map each alternate spelling to the EXACT pool name so salaries,
// flags, photos, bios, and dedup all resolve to one player.
export const NAME_ALIASES: Record<string, string> = {
  'Samuel Stevens': 'Sam Stevens',
  'Benjamin James': 'Ben James',
  'Christopher Gotterup': 'Chris Gotterup',
  'John Keefer': 'Johnny Keefer',
  'Joohyung Kim': 'Tom Kim',
  'Matthew Fitzpatrick': 'Matt Fitzpatrick',
  'Matthew McCarty': 'Matt McCarty',
  'Matthias Schmid': 'Matti Schmid',
  'Nicolas Echavarria': 'Nico Echavarria',
  'JT Poston': 'J.T. Poston',
  'Daniel Brown': 'Dan Brown',
  'Jayden Schaper': 'Jayden Trey Schaper',
  'Eugenio Lopez-Chacarra': 'Eugenio Chacarra',
  'Jose Ballester': 'Jose Luis Ballester Barrio',
  'Josele Ballester': 'Jose Luis Ballester Barrio',
};

// Case/space-insensitive lookup so "benjamin james" resolves too.
const NAME_ALIASES_NORM: Record<string, string> = {};
for (const [k, v] of Object.entries(NAME_ALIASES)) {
  NAME_ALIASES_NORM[k.toLowerCase().replace(/\s+/g, ' ').trim()] = v;
}

// Return the pool name for a possibly-aliased spelling (unchanged if there's no alias).
export function applyNameAlias(name: string): string {
  if (!name) return name;
  return NAME_ALIASES[name] ?? NAME_ALIASES_NORM[name.toLowerCase().replace(/\s+/g, ' ').trim()] ?? name;
}
