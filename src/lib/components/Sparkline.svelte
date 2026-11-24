<script lang="ts">
  import { getTheme } from "../theme.js";
  import type { ColorValue } from "../types.js";

  let {
    data,
    width,
    min,
    max,
    color = getTheme().accent,
  }: {
    data: number[];
    /** Number of cells; with more data than that, the most recent values are shown */
    width?: number;
    min?: number;
    max?: number;
    color?: ColorValue;
  } = $props();

  const BARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  const line = $derived.by(() => {
    const values = width !== undefined ? data.slice(-width) : data;
    if (values.length === 0) return "";
    const lo = min ?? Math.min(...values);
    const hi = max ?? Math.max(...values);
    const range = hi - lo;
    return values
      .map((v) =>
        range === 0
          ? BARS[3]
          : BARS[
              Math.round(((Math.min(hi, Math.max(lo, v)) - lo) / range) * 7)
            ],
      )
      .join("")
      .padStart(width ?? 0, " ");
  });
</script>

<txt wrap="none" {color}>{line}</txt>
