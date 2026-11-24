<script lang="ts">
  import type { KeyEvent, LayoutEvent, WheelEvent } from "../runtime/events.js";
  import type { ColorValue, Dimension, WrapMode } from "../types.js";
  import Scrollbar from "./Scrollbar.svelte";

  type Line =
    | string
    | { text: string; color?: ColorValue; dim?: boolean; bold?: boolean };

  let {
    lines,
    height,
    grow,
    follow = true,
    scrollbar = true,
    focusable = true,
    wrap = "truncate",
  }: {
    lines: Line[];
    /** Give the log a height, or `grow` inside a sized parent */
    height?: Dimension;
    grow?: number | boolean;
    /** Stick to the bottom as lines are added (until the user scrolls up) */
    follow?: boolean;
    scrollbar?: boolean;
    focusable?: boolean;
    /** How long lines are shown (lines never wrap, so only visible lines are rendered) */
    wrap?: Exclude<WrapMode, "wrap">;
  } = $props();

  let viewport = $state(0);
  let offset = $state(0);
  let detached = $state(false);

  const max = $derived(Math.max(0, lines.length - viewport));
  const top = $derived(follow && !detached ? max : Math.min(offset, max));
  const visible = $derived(
    lines
      .slice(top, top + viewport)
      .map((line) => (typeof line === "string" ? { text: line } : line)),
  );

  function scroll(to: number) {
    offset = Math.max(0, Math.min(max, to));
    detached = offset < max;
  }

  function onkeydown(event: KeyEvent) {
    const k = event.key;
    if (k === "ArrowUp" || event.is("k")) scroll(top - 1);
    else if (k === "ArrowDown" || event.is("j")) scroll(top + 1);
    else if (k === "PageUp") scroll(top - Math.max(1, viewport - 1));
    else if (k === "PageDown") scroll(top + Math.max(1, viewport - 1));
    else if (k === "Home" || event.is("g")) scroll(0);
    else if (k === "End" || event.is("G")) scroll(max);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<box
  row
  {height}
  {grow}
  {focusable}
  {onkeydown}
  onwheel={(e: WheelEvent) => scroll(top + e.deltaY * 3)}
>
  <box grow={1} onlayout={(e: LayoutEvent) => (viewport = e.height)}>
    {#each visible as line, i (i + top)}
      <txt {wrap} color={line.color} dim={line.dim} bold={line.bold}
        >{line.text || " "}</txt
      >
    {/each}
  </box>
  {#if scrollbar && lines.length > viewport && viewport > 0}
    <Scrollbar
      total={lines.length}
      visible={viewport}
      offset={top}
      height={viewport}
    />
  {/if}
</box>
