<script lang="ts" generics="T">
  import type { KeyEvent, WheelEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import type { ColorValue } from "../types.js";
  import { normalizeItems } from "../items.js";
  import type { SelectItem } from "../types.js";
  import Scrollbar from "./Scrollbar.svelte";

  let {
    items,
    value = $bindable(),
    height,
    indicator = "❯",
    disabled = false,
    autofocus = false,
    emptyText = "Nothing here",
    onchange,
    onselect,
  }: {
    items: Array<SelectItem<T> | T>;
    value?: T;
    /** Number of visible rows (default: all items, up to 10) */
    height?: number;
    indicator?: string;
    disabled?: boolean;
    autofocus?: boolean;
    emptyText?: string;
    /** Called when the highlighted item changes */
    onchange?: (value: T) => void;
    /** Called on Enter or click */
    onselect?: (value: T) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);
  let offset = $state(0);

  const list = $derived(normalizeItems(items));
  const rows = $derived(Math.max(1, height ?? Math.min(list.length, 10)));
  const index = $derived(
    Math.max(
      0,
      list.findIndex((item) => item.value === value),
    ),
  );

  // keep the highlighted row in view
  const top = $derived.by(() => {
    let start = Math.min(offset, Math.max(0, list.length - rows));
    if (index < start) start = index;
    if (index >= start + rows) start = index - rows + 1;
    return Math.max(0, start);
  });

  $effect.pre(() => {
    offset = top;
  });

  // select the first item if the value isn't in the list
  $effect.pre(() => {
    if (list.length > 0 && !list.some((item) => item.value === value)) {
      const first = list.find((item) => !item.disabled);
      if (first) value = first.value;
    }
  });

  function move(delta: number) {
    if (list.length === 0) return;
    let i = index;
    for (let step = 0; step < list.length; step++) {
      const next = Math.max(0, Math.min(list.length - 1, i + delta));
      if (next === i) break;
      i = next;
      if (!list[i].disabled) {
        value = list[i].value;
        onchange?.(list[i].value);
        return;
      }
      delta = Math.sign(delta);
    }
  }

  function choose(i: number) {
    const item = list[i];
    if (!item || item.disabled || disabled) return;
    if (value !== item.value) {
      value = item.value;
      onchange?.(item.value);
    }
    onselect?.(item.value);
  }

  function onkeydown(event: KeyEvent) {
    if (disabled) return;
    const k = event.key;
    if (k === "ArrowUp" || event.is("k")) move(-1);
    else if (k === "ArrowDown" || event.is("j")) move(1);
    else if (k === "PageUp") move(-rows);
    else if (k === "PageDown") move(rows);
    else if (k === "Home") move(-list.length);
    else if (k === "End") move(list.length);
    else if (k === "Enter" || k === " ") choose(index);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onwheel(event: WheelEvent) {
    move(event.deltaY);
  }
</script>

<box
  row
  focusable={!disabled}
  {disabled}
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onkeydown}
  {onwheel}
>
  <box grow={1}>
    {#if list.length === 0}
      <txt color={theme.muted} italic>{emptyText}</txt>
    {/if}
    {#each list.slice(top, top + rows) as item, i (i + top)}
      {@const active = i + top === index}
      <box row onclick={() => choose(i + top)}>
        <txt
          wrap="truncate"
          grow={1}
          bold={active}
          color={item.disabled
            ? theme.muted
            : active
              ? focused
                ? theme.onAccent
                : theme.accent
              : item.color}
          bg={active && focused ? theme.accent : undefined}
          >{active ? indicator : " "} {item.label}</txt
        >
        {#if item.hint}
          <txt
            wrap="none"
            color={active && focused ? theme.onAccent : theme.muted}
            bg={active && focused ? theme.accent : undefined}
            >{" "}{item.hint}{" "}</txt
          >
        {/if}
      </box>
    {/each}
  </box>
  {#if list.length > rows}
    <Scrollbar total={list.length} visible={rows} offset={top} height={rows} />
  {/if}
</box>
