// Order-independent canonical key for matching player names regardless of how they're written:
// "Patrick Reed", "Reed, Patrick", "REED Patrick" all collapse to the same key ("patrick reed").
// Strips accents/punctuation, lowercases, then sorts the name tokens so first/last order doesn't matter.
export function canonicalNameKey(name: string): string {
  return name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/ø/gi, 'o').replace(/æ/gi, 'ae').replace(/ß/gi, 'ss')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

// Detect amateur / PGA-club-professional markers on a name as they appear in field & leaderboard lists,
// and return the CLEAN name (markers removed) so name matching still works. Conventions:
//   Amateur  → "(a)", "(am)", "(amateur)"   (universal golf convention)
//   Club pro → "(c)", "(cp)", "(club pro)"  (mark PGA Championship club pros with one of these)
export function detectPlayerTags(rawName: string): { name: string; amateur: boolean; clubPro: boolean } {
  const amateur = /\(\s*am?(?:ateur)?\s*\)/i.test(rawName);
  const clubPro = /\(\s*(?:cp?|club\s*pro?)\s*\)/i.test(rawName);
  const name = rawName
    .replace(/\(\s*(?:am?(?:ateur)?|cp?|club\s*pro?)\s*\)/ig, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { name, amateur, clubPro };
}
