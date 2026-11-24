/** Handed to bench scenes through context (key `"bench"`) */
export interface Bench {
  /** Set by the scene: makes one change, without rendering */
  tick?: () => void;
  /** Scene size parameter (rows, lines, ...) */
  count?: number;
}
