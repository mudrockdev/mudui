<script lang="ts">
  import type { LayoutEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import type { ColorValue, Dimension } from "../types.js";

  let {
    value = 0,
    max = 1,
    width,
    color = getTheme().accent,
    trackColor = getTheme().muted,
    showPercent = false,
    label,
  }: {
    value?: number;
    max?: number;
    width?: Dimension;
    color?: ColorValue;
    trackColor?: ColorValue;
    showPercent?: boolean;
    label?: string;
  } = $props();

  const PARTIAL = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

  let cells = $state(0);
  const ratio = $derived(
    max > 0 && Number.isFinite(value / max)
      ? Math.min(1, Math.max(0, value / max))
      : 0,
  );
  const bar = $derived.by(() => {
    const eighths = Math.round(ratio * cells * 8);
    const full = Math.floor(eighths / 8);
    const partial = PARTIAL[eighths % 8];
    const filled = "█".repeat(full) + partial;
    const rest = Math.max(0, cells - full - (partial ? 1 : 0));
    return { filled, rest: "░".repeat(rest) };
  });
</script>

<box row gap={1} {width}>
  {#if label}<txt>{label}</txt>{/if}
  <!-- scrollX: the bar takes the free space, rather than the width it drew last -->
  <box grow={1} scrollX={0} onlayout={(e: LayoutEvent) => (cells = e.width)}>
    <txt wrap="none"
      ><txt {color}>{bar.filled}</txt><txt color={trackColor}>{bar.rest}</txt
      ></txt
    >
  </box>
  {#if showPercent}<txt width={4} textAlign="right"
      >{Math.round(ratio * 100)}%</txt
    >{/if}
</box>
