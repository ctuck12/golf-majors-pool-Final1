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
