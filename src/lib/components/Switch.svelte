<script lang="ts">
  import type { KeyEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";

  let {
    checked = $bindable(false),
    label = "",
    disabled = false,
    autofocus = false,
    onchange,
  }: {
    checked?: boolean;
    label?: string;
    disabled?: boolean;
    autofocus?: boolean;
    onchange?: (checked: boolean) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);

  function set(next: boolean) {
    if (disabled || next === checked) return;
    checked = next;
    onchange?.(next);
  }

  function onkeydown(event: KeyEvent) {
    if (event.key === " " || event.key === "Enter") set(!checked);
    else if (event.key === "ArrowLeft" || event.is("h")) set(false);
    else if (event.key === "ArrowRight" || event.is("l")) set(true);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<box
  row
  focusable
  {disabled}
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onclick={() => set(!checked)}
  {onkeydown}
>
  <txt
    wrap="none"
    color={disabled ? theme.muted : checked ? theme.success : theme.muted}
    bold={focused}>{checked ? "━━●" : "●━━"}</txt
  >
  <txt
    wrap="none"
    color={disabled ? theme.muted : focused ? theme.accent : undefined}
    bold={focused}>{" "}{checked ? "on " : "off"}{label ? ` ${label}` : ""}</txt
  >
</box>
