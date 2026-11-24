<script lang="ts">
  import type { Snippet } from "svelte";
  import { useInput } from "../runtime/context.js";
  import { getTheme } from "../theme.js";
  import type { BorderStyle, ColorValue, Dimension } from "../types.js";

  let {
    title,
    width,
    border = "round",
    borderColor = getTheme().accent,
    bg = getTheme().surface,
    onclose,
    children,
  }: {
    title?: string;
    width?: Dimension;
    border?: BorderStyle;
    borderColor?: ColorValue;
    bg?: ColorValue;
    /** Called when Escape is pressed */
    onclose?: () => void;
    children?: Snippet;
  } = $props();

  // modal: handle Escape and keep keys from reaching handlers registered before the modal
  useInput((event) => {
    if (event.key === "Escape") onclose?.();
    event.stopPropagation();
  });
</script>

<box
  position="absolute"
  top={0}
  left={0}
  right={0}
  bottom={0}
  align="center"
  justify="center"
  trapfocus
>
  <box
    {border}
    {borderColor}
    {title}
    {bg}
    {width}
    maxWidth="90%"
    paddingX={2}
    paddingY={1}
    gap={1}
  >
    {@render children?.()}
  </box>
</box>
