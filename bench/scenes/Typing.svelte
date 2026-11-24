<!-- Input latency: keystrokes into a focused TextInput inside a form. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Bench } from "../bench.ts";
  import { Panel, TextInput, Button } from "../../src/lib/index.ts";

  const bench = getContext<Bench>("bench");
  let name = $state("");
  let notes = $state("");
  bench.tick = () => {};
</script>

<box height="100%" padding={1}>
  <Panel title="Profile" width={50}>
    <txt>Name</txt>
    <TextInput bind:value={name} autofocus placeholder="Your name" />
    <txt>Notes</txt>
    <TextInput bind:value={notes} placeholder="Anything else" />
    <box row gap={2}>
      <Button label="Save" variant="primary" />
      <Button label="Cancel" />
    </box>
    <txt dim>{name.length} characters</txt>
  </Panel>
</box>
