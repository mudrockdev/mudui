<script lang="ts">
  import { getTheme } from "../theme.js";
  import type { ColorValue } from "../types.js";

  let {
    total,
    visible,
    offset,
    height,
    color = getTheme().accent,
    trackColor = getTheme().muted,
  }: {
    /** Total number of rows of content */
    total: number;
    /** Number of rows that fit */
    visible: number;
    /** First visible row */
    offset: number;
    /** Height of the scrollbar in cells */
    height: number;
    color?: ColorValue;
    trackColor?: ColorValue;
  } = $props();

  const thumb = $derived.by(() => {
    if (total <= visible || height <= 0) return { start: 0, size: 0 };
    const size = Math.max(1, Math.round((visible / total) * height));
    const max_offset = total - visible;
    const start = Math.round(
      (Math.min(offset, max_offset) / max_offset) * (height - size),
    );
    return { start, size };
  });
</script>

<box width={1} shrink={0}>
  {#each { length: Math.max(0, height) }, i}
    {#if i >= thumb.start && i < thumb.start + thumb.size}
      <txt {color}>┃</txt>
    {:else}
      <txt color={trackColor}>│</txt>
    {/if}
  {/each}
</box>
