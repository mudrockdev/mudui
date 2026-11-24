<script lang="ts" generics="T">
  import type { KeyEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import { normalizeItems } from "../items.js";
  import type { SelectItem } from "../types.js";

  let {
    items,
    value = $bindable(),
    direction = "column",
    disabled = false,
    autofocus = false,
    onchange,
  }: {
    items: Array<SelectItem<T> | T>;
    value?: T;
    direction?: "row" | "column";
    disabled?: boolean;
    autofocus?: boolean;
    onchange?: (value: T) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);

  const list = $derived(normalizeItems(items));
  const index = $derived(list.findIndex((item) => item.value === value));

  function choose(i: number) {
    const item = list[i];
    if (disabled || !item || item.disabled || item.value === value) return;
    value = item.value;
    onchange?.(item.value);
  }

  function move(delta: number) {
    let i = index === -1 ? (delta > 0 ? -1 : list.length) : index;
    for (let step = 0; step < list.length; step++) {
      i = (i + delta + list.length) % list.length;
      if (!list[i].disabled) return choose(i);
    }
  }

  function onkeydown(event: KeyEvent) {
    const k = event.key;
    if (k === "ArrowUp" || k === "ArrowLeft" || event.is("k") || event.is("h"))
      move(-1);
    else if (
      k === "ArrowDown" ||
      k === "ArrowRight" ||
      event.is("j") ||
      event.is("l")
    )
      move(1);
    else if ((k === " " || k === "Enter") && index === -1) move(1);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<box
  {direction}
  gap={direction === "row" ? 2 : 0}
  focusable={!disabled}
  {disabled}
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onkeydown}
>
  {#each list as item, i (i)}
    {@const selected = i === index}
    <txt
      wrap="none"
      onclick={() => choose(i)}
      color={item.disabled || disabled
        ? theme.muted
        : selected && focused
          ? theme.accent
          : undefined}
      bold={selected && focused}>{selected ? "(●)" : "( )"} {item.label}</txt
    >
  {/each}
</box>
