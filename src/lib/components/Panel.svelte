<script lang="ts">
  import { getTheme } from "../theme.js";
  import type { BorderStyle, BoxAttributes, ColorValue } from "../types.js";

  let {
    title,
    border = "round",
    accent = getTheme().accent,
    borderColor = getTheme().border,
    paddingX = 1,
    children,
    ...rest
  }: BoxAttributes & {
    title?: string;
    border?: BorderStyle;
    /** Border color while something inside the panel is focused */
    accent?: ColorValue;
    borderColor?: ColorValue;
  } = $props();

  let active = $state(false);
</script>

<box
  {...rest}
  {border}
  {title}
  {paddingX}
  borderColor={active ? accent : borderColor}
  onfocusin={() => (active = true)}
  onfocusout={() => (active = false)}
>
  {@render children?.()}
</box>
