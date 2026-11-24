<script lang="ts">
  import type { LayoutEvent } from "../runtime/events.js";
  import { stringWidth } from "../renderer/text.js";
  import { getTheme } from "../theme.js";
  import type { BarChartItem, ColorValue } from "../types.js";

  let {
    data,
    max,
    showValues = true,
    format = (v: number) => String(v),
    color = getTheme().accent,
  }: {
    data: BarChartItem[];
    /** The value of a full-width bar (default: the largest value) */
    max?: number;
    showValues?: boolean;
    format?: (value: number) => string;
    color?: ColorValue;
  } = $props();

  const theme = getTheme();
  const PARTIAL = ["", "▏", "▎", "▍", "▌", "▋", "▊", "▉"];

  let width = $state(0);
  const label_width = $derived(
    Math.max(0, ...data.map((d) => stringWidth(d.label))),
  );
  const value_width = $derived(
    showValues
      ? Math.max(0, ...data.map((d) => stringWidth(format(d.value))))
      : 0,
  );
  const bar_width = $derived(
    Math.max(1, width - label_width - value_width - (showValues ? 2 : 1)),
  );
  const top = $derived(max ?? Math.max(0, ...data.map((d) => d.value)));

  function bar(value: number) {
    const eighths =
      top > 0
        ? Math.round((Math.max(0, Math.min(value, top)) / top) * bar_width * 8)
        : 0;
    return "█".repeat(Math.floor(eighths / 8)) + PARTIAL[eighths % 8];
  }
</script>

<box onlayout={(e: LayoutEvent) => (width = e.width)}>
  {#each data as item, i (i)}
    <box row gap={1}>
      <txt width={label_width} wrap="truncate">{item.label}</txt>
      <txt width={bar_width} wrap="none" color={item.color ?? color}
        >{bar(item.value)}</txt
      >
      {#if showValues}<txt
          width={value_width}
          textAlign="right"
          color={theme.muted}>{format(item.value)}</txt
        >{/if}
    </box>
  {/each}
</box>
