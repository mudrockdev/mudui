<script lang="ts">
  import type { Snippet } from "svelte";
  import type { KeyEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";

  let {
    title,
    open = $bindable(false),
    autofocus = false,
    indent = 2,
    ontoggle,
    children,
  }: {
    title: string;
    open?: boolean;
    autofocus?: boolean;
    /** Indentation of the content */
    indent?: number;
    ontoggle?: (open: boolean) => void;
    children?: Snippet;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);

  function toggle() {
    open = !open;
    ontoggle?.(open);
  }

  function onkeydown(event: KeyEvent) {
    const k = event.key;
    if (k === " " || k === "Enter") toggle();
    else if ((k === "ArrowRight" || event.is("l")) && !open) toggle();
    else if ((k === "ArrowLeft" || event.is("h")) && open) toggle();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<box>
  <box
    row
    focusable
    {autofocus}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
    onclick={toggle}
    {onkeydown}
  >
    <txt wrap="truncate" bold color={focused ? theme.accent : undefined}
      >{open ? "▾" : "▸"} {title}</txt
    >
  </box>
  {#if open}
    <box paddingLeft={indent}>{@render children?.()}</box>
  {/if}
</box>
