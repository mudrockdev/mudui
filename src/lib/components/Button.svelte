<script lang="ts">
  import type { Snippet } from "svelte";
  import type { KeyEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import type { ColorValue } from "../types.js";

  type Variant = "default" | "primary" | "success" | "danger" | "warning";

  let {
    label,
    children,
    onclick,
    variant = "default",
    disabled = false,
    autofocus = false,
    color,
  }: {
    label?: string;
    children?: Snippet;
    onclick?: () => void;
    variant?: Variant;
    disabled?: boolean;
    autofocus?: boolean;
    color?: ColorValue;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);

  const tint = $derived(
    color ??
      {
        default: "white",
        primary: theme.accent,
        success: theme.success,
        danger: theme.danger,
        warning: theme.warning,
      }[variant],
  );

  function press() {
    if (!disabled) onclick?.();
  }

  function onkeydown(event: KeyEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      press();
    }
  }
</script>

<box
  focusable
  {disabled}
  {autofocus}
  alignSelf="start"
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onclick={press}
  {onkeydown}
>
  <txt
    wrap="none"
    color={disabled ? theme.muted : focused ? theme.onAccent : tint}
    bg={focused && !disabled ? tint : undefined}
    bold={focused}
    >{focused ? " " : "["}
    {label ?? ""}{@render children?.()}
    {focused ? " " : "]"}</txt
  >
</box>
