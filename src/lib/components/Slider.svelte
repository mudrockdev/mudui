<script lang="ts">
  import type {
    KeyEvent,
    LayoutEvent,
    MouseEvent,
    WheelEvent,
  } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import type { ColorValue, Dimension } from "../types.js";

  let {
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 1,
    width,
    label,
    showValue = true,
    format = (v: number) => String(v),
    color = getTheme().accent,
    disabled = false,
    autofocus = false,
    onchange,
  }: {
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    width?: Dimension;
    label?: string;
    showValue?: boolean;
    format?: (value: number) => string;
    color?: ColorValue;
    disabled?: boolean;
    autofocus?: boolean;
    onchange?: (value: number) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);
  let cells = $state(0);

  const ratio = $derived(
    max > min ? (Math.min(max, Math.max(min, value)) - min) / (max - min) : 0,
  );
  const knob = $derived(Math.round(ratio * Math.max(0, cells - 1)));

  function set(next: number) {
    if (disabled) return;
    const snapped = Math.round((next - min) / step) * step + min;
    const clamped = Math.min(max, Math.max(min, Number(snapped.toFixed(10))));
    if (clamped === value) return;
    value = clamped;
    onchange?.(clamped);
  }

  function onkeydown(event: KeyEvent) {
    const k = event.key;
    if (k === "ArrowLeft" || k === "ArrowDown" || event.is("h"))
      set(value - step);
    else if (k === "ArrowRight" || k === "ArrowUp" || event.is("l"))
      set(value + step);
    else if (k === "PageDown") set(value - step * 10);
    else if (k === "PageUp") set(value + step * 10);
    else if (k === "Home") set(min);
    else if (k === "End") set(max);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onclick(event: MouseEvent) {
    if (cells > 1)
      set(
        min +
          (Math.min(cells - 1, Math.max(0, event.localX)) / (cells - 1)) *
            (max - min),
      );
  }
</script>

<box
  row
  gap={1}
  {width}
  focusable={!disabled}
  {disabled}
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onkeydown}
  onwheel={(e: WheelEvent) => set(value - e.deltaY * step)}
>
  {#if label}<txt
      wrap="none"
      shrink={0}
      bold={focused}
      color={focused ? theme.accent : undefined}>{label}</txt
    >{/if}
  <!-- scrollX: the track takes the free space, rather than the width it drew last -->
  <box
    grow={1}
    scrollX={0}
    onlayout={(e: LayoutEvent) => (cells = e.width)}
    {onclick}
  >
    <txt wrap="none"
      ><txt color={disabled ? theme.muted : color}>{"━".repeat(knob)}</txt><txt
        color={disabled ? theme.muted : focused ? color : undefined}
        bold>{cells > 0 ? (focused ? "◆" : "●") : ""}</txt
      ><txt color={theme.muted}>{"─".repeat(Math.max(0, cells - knob - 1))}</txt
      ></txt
    >
  </box>
  {#if showValue}<txt wrap="none" shrink={0}>{format(value)}</txt>{/if}
</box>
