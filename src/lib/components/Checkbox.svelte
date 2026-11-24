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

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }

  function onkeydown(event: KeyEvent) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      toggle();
    }
  }
</script>

<box
  row
  focusable
  {disabled}
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onclick={toggle}
  {onkeydown}
>
  <txt
    wrap="none"
    color={disabled ? theme.muted : focused ? theme.accent : undefined}
    bold={focused}>{checked ? "[x]" : "[ ]"} {label}</txt
  >
</box>
