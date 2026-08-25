/**
 * Forgiving text matching for place names.
 *
 * People type "Katnga" for Katanga and "napiar town" for Napier Town. An exact
 * match finds neither, so this scores candidates on several signals — prefix,
 * substring, word starts, and edit distance — and returns the closest.
 *
 * Deliberately small: no dependency, and fast enough for a couple of hundred
 * localities on every keystroke.
 */

/** Levenshtein distance, capped so long mismatches exit early. */
function editDistance(a: string, b: string, cap = 4): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let best = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current[j] = value;
      if (value < best) best = value;
    }

    if (best > cap) return cap + 1; // no route back under the cap
    previous = current;
  }

  return previous[b.length];
}

const normalise = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Scores a candidate against a search term. Higher is better; 0 means no match.
 */
export function matchScore(term: string, candidate: string): number {
  const a = normalise(term);
  const b = normalise(candidate);
  if (!a) return 0;

  if (b === a) return 1000;
  if (b.startsWith(a)) return 900 - (b.length - a.length);
  if (b.includes(a)) return 700 - b.indexOf(a);

  // "napiar town" against "Napier Town": compare word by word.
  const termWords = a.split(' ');
  const candidateWords = b.split(' ');
  let wordScore = 0;

  for (const word of termWords) {
    let best = 0;
    for (const other of candidateWords) {
      if (other.startsWith(word)) best = Math.max(best, 500);
      else {
        const distance = editDistance(word, other, word.length <= 4 ? 1 : 2);
        if (distance <= (word.length <= 4 ? 1 : 2)) best = Math.max(best, 420 - distance * 40);
      }
    }
    wordScore += best;
  }
  if (wordScore > 0) return Math.round(wordScore / termWords.length);

  // Whole-string near miss: "katnga" against "katanga".
  const cap = a.length <= 5 ? 1 : a.length <= 8 ? 2 : 3;
  const distance = editDistance(a, b, cap);
  if (distance <= cap) return 400 - distance * 60;

  return 0;
}

/** The best matches for a term, closest first. */
export function fuzzySearch<T>(term: string, items: T[], toText: (item: T) => string, limit = 8): T[] {
  if (!term.trim()) return items.slice(0, limit);

  return items
    .map((item) => ({ item, score: matchScore(term, toText(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}
