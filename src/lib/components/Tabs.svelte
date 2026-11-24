<script lang="ts" generics="T">
  import { stringWidth } from "../renderer/text.js";
  import type { KeyEvent, LayoutEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import { normalizeItems } from "../items.js";
  import type { SelectItem } from "../types.js";

  let {
    items,
    value = $bindable(),
    autofocus = false,
    onchange,
  }: {
    items: Array<SelectItem<T> | T>;
    value?: T;
    autofocus?: boolean;
    onchange?: (value: T) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);

  const list = $derived(normalizeItems(items));
  const index = $derived(list.findIndex((item) => item.value === value));

  // start on (and fall back to) the first tab that can be chosen
  $effect.pre(() => {
    if (index === -1 && list.length > 0) {
      const first = list.find((item) => !item.disabled) ?? list[0];
      value = first.value;
    }
  });

  function select(i: number) {
    const item = list[i];
    if (!item || item.disabled || item.value === value) return;
    value = item.value;
    onchange?.(item.value);
  }

  /** Selects the next tab in `direction` that isn't disabled, wrapping around */
  function step(direction: 1 | -1) {
    const n = list.length;
    for (let k = 1; k < n; k++) {
      const i = (((index + direction * k) % n) + n) % n;
      if (!list[i].disabled) return select(i);
    }
  }

  function onkeydown(event: KeyEvent) {
    if (event.key === "ArrowLeft" || event.is("h")) step(-1);
    else if (event.key === "ArrowRight" || event.is("l")) step(1);
    else if (/^[1-9]$/.test(event.key) && !event.ctrl && !event.alt)
      select(Number(event.key) - 1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  // When the tabs don't fit, the strip scrolls so that the active tab is
  // visible. Labels never shrink; the strip is clipped instead.
  /** Width of the visible part of the strip (measured) */
  let room = $state(Infinity);
  let offset = $state(0);

  /** Start and end column of each tab in the strip (separators are 1 wide) */
  const spans = $derived.by(() => {
    let x = 0;
    return list.map((item, i) => {
      if (i > 0) x += 1;
      const start = x;
      x += stringWidth(item.label) + 2;
      return { start, end: x };
    });
  });
  const total = $derived(spans.at(-1)?.end ?? 0);

  /** The first tab start at or after column `x`, so no label is cut on the left */
  const snap = (x: number) => spans.find((s) => s.start >= x)?.start ?? x;

  const scroll = $derived.by(() => {
    if (total <= room) return 0;
    let start = snap(Math.min(offset, total - room));
    const span = spans[index];
    if (span) {
      if (span.start < start) start = span.start;
      else if (span.end > start + room)
        start = Math.min(span.start, snap(span.end - room));
    }
    return Math.max(0, start);
  });
  $effect.pre(() => {
    offset = scroll;
  });
</script>

<box
  row
  focusable
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onkeydown}
>
  {#if scroll > 0}<txt wrap="none" shrink={0} color={theme.muted}>‹</txt>{/if}
  <box row scrollX={scroll} onlayout={(e: LayoutEvent) => (room = e.width)}>
    {#each list as item, i (i)}
      {@const active = i === index}
      {#if i > 0}<txt wrap="none" shrink={0} color={theme.muted}>│</txt>{/if}
      <txt
        wrap="none"
        shrink={0}
        onclick={() => select(i)}
        bold={active}
        underline={active && !focused}
        color={item.disabled
          ? theme.muted
          : active
            ? focused
              ? theme.onAccent
              : theme.accent
            : undefined}
        bg={active && focused ? theme.accent : undefined}
        >{" "}{item.label}{" "}</txt
      >
    {/each}
  </box>
  {#if scroll + room < total}<txt wrap="none" shrink={0} color={theme.muted}
      >›</txt
    >{/if}
</box>
