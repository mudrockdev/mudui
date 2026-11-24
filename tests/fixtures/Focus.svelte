<script lang="ts">
  import { Button, useInput } from "../../src/lib/index.ts";

  let pressed = $state("");
  let global = $state("");
  let show_third = $state(true);

  useInput((event) => {
    if (event.is("g")) global += "g";
    if (event.is("ctrl+t")) show_third = !show_third;
  });
</script>

<box>
  <box row gap={1}>
    <Button label="One" onclick={() => (pressed = "one")} />
    <Button label="Two" onclick={() => (pressed = "two")} />
    {#if show_third}<Button
        label="Three"
        onclick={() => (pressed = "three")}
      />{/if}
    <Button label="Off" disabled onclick={() => (pressed = "off")} />
  </box>
  <txt>pressed: {pressed}</txt>
  <txt>global: {global}</txt>
</box>
