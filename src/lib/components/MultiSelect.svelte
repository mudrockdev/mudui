<script lang="ts" generics="T">
  import type { KeyEvent, WheelEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import { normalizeItems } from "../items.js";
  import type { SelectItem } from "../types.js";
  import Scrollbar from "./Scrollbar.svelte";

  let {
    items,
    value = $bindable([]),
    height,
    disabled = false,
    autofocus = false,
    emptyText = "Nothing here",
    onchange,
    onsubmit,
  }: {
    items: Array<SelectItem<T> | T>;
    /** The checked values */
    value?: T[];
    /** Number of visible rows (default: all items, up to 10) */
    height?: number;
    disabled?: boolean;
    autofocus?: boolean;
    emptyText?: string;
    onchange?: (value: T[]) => void;
    /** Called on Enter */
    onsubmit?: (value: T[]) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);
  let cursor = $state(0);
  let offset = $state(0);

  const list = $derived(normalizeItems(items));
  const rows = $derived(Math.max(1, height ?? Math.min(list.length, 10)));
  const index = $derived(Math.max(0, Math.min(cursor, list.length - 1)));
  const top = $derived.by(() => {
    let start = Math.min(offset, Math.max(0, list.length - rows));
    if (index < start) start = index;
    if (index >= start + rows) start = index - rows + 1;
    return Math.max(0, start);
  });

  $effect.pre(() => {
    offset = top;
  });

  function update(next: T[]) {
    value = next;
    onchange?.(next);
  }

  function toggle(i: number) {
    const item = list[i];
    if (!item || item.disabled || disabled) return;
    update(
      value.includes(item.value)
        ? value.filter((v) => v !== item.value)
        : [...value, item.value],
    );
  }

  function toggle_all() {
    const enabled = list
      .filter((item) => !item.disabled)
      .map((item) => item.value);
    update(enabled.every((v) => value.includes(v)) ? [] : enabled);
  }

  function onkeydown(event: KeyEvent) {
    if (disabled) return;
    const k = event.key;
    if (k === "ArrowUp" || event.is("k")) cursor = Math.max(0, index - 1);
    else if (k === "ArrowDown" || event.is("j"))
      cursor = Math.min(list.length - 1, index + 1);
    else if (k === "PageUp") cursor = Math.max(0, index - rows);
    else if (k === "PageDown") cursor = Math.min(list.length - 1, index + rows);
    else if (k === "Home") cursor = 0;
    else if (k === "End") cursor = list.length - 1;
    else if (k === " " || event.is("x")) toggle(index);
    else if (event.is("a")) toggle_all();
    else if (k === "Enter") onsubmit?.(value);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function onwheel(event: WheelEvent) {
    cursor = Math.max(0, Math.min(list.length - 1, index + event.deltaY));
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
      {@const active = focused && i + top === index}
      {@const checked = value.includes(item.value)}
      <box
        row
        onclick={() => {
          cursor = i + top;
          toggle(i + top);
        }}
      >
        <txt
          grow={1}
          wrap="truncate"
          color={item.disabled
            ? theme.muted
            : active
              ? theme.onAccent
              : checked
                ? theme.accent
                : undefined}
          bg={active ? theme.accent : undefined}
          bold={active}>{checked ? "[x]" : "[ ]"} {item.label}</txt
        >
        {#if item.hint}
          <txt
            wrap="none"
            color={active ? theme.onAccent : theme.muted}
            bg={active ? theme.accent : undefined}>{" "}{item.hint}{" "}</txt
          >
        {/if}
      </box>
    {/each}
  </box>
  {#if list.length > rows}
    <Scrollbar total={list.length} visible={rows} offset={top} height={rows} />
  {/if}
</box>
