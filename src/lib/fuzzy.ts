/**
 * Fuzzy matching for search-as-you-type components.
 */

export interface FuzzyMatch {
  score: number;
  /** Indices (into `Array.from(text)`) of the matched characters */
  positions: number[];
}

const is_boundary = (ch: string | undefined) =>
  ch === undefined || /[\s\-_./:\\]/.test(ch);

/**
 * Matches `query` as a case-insensitive subsequence of `text`. Consecutive
 * matches and matches at word starts score higher. Returns `null` if it doesn't match.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = Array.from(query.toLowerCase().trim());
  if (q.length === 0) return { score: 0, positions: [] };
  const chars = Array.from(text);
  const lower = chars.map((c) => c.toLowerCase());

  // prefer a contiguous match if there is one
  const joined = lower.join("");
  const substring = joined.indexOf(q.join(""));
  if (substring !== -1) {
    const start = Array.from(joined.slice(0, substring)).length;
    const positions = q.map((_, i) => start + i);
    const score =
      100 + q.length * 10 + (is_boundary(chars[start - 1]) ? 20 : 0) - start;
    return { score, positions };
  }

  const positions: number[] = [];
  let score = 0;
  let j = 0;
  for (let i = 0; i < q.length; i++) {
    while (j < lower.length && lower[j] !== q[i]) j++;
    if (j === lower.length) return null;
    positions.push(j);
    score += 1;
    if (i > 0 && positions[i - 1] === j - 1) score += 5;
    if (is_boundary(chars[j - 1])) score += 8;
    j++;
  }
  return {
    score: score - (positions[positions.length - 1] - positions[0]) * 0.1,
    positions,
  };
}

/** Splits `text` into runs of matched / unmatched characters, for highlighting */
export function highlight(
  text: string,
  positions: number[],
): Array<{ text: string; match: boolean }> {
  const set = new Set(positions);
  const out: Array<{ text: string; match: boolean }> = [];
  Array.from(text).forEach((ch, i) => {
    const match = set.has(i);
    const last = out[out.length - 1];
    if (last && last.match === match) last.text += ch;
    else out.push({ text: ch, match });
  });
  return out;
}
