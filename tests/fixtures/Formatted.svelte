<script lang="ts">
  let {
    label = "Open",
    focused = false,
  }: { label?: string; focused?: boolean } = $props();
</script>

<!-- written the way Prettier wraps long lines: line breaks where the source had spaces -->
<box>
  <txt wrap="none" bold={focused}
    >{focused ? " " : "["}
    {label}
    {focused ? " " : "]"}</txt
  >
  <txt> Leading and trailing whitespace </txt>
  <txt
    >one <txt bold>two</txt>
    <txt italic>three</txt></txt
  >
  <txt>{"dynamic\nline breaks stay"}</txt>
</box>
