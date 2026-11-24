<script lang="ts">
  import { Checkbox, Button, Slider, ScrollView, TextInput, useInput } from "../../../src/lib/index.ts";
  let { mode = "checkbox" }: { mode?: string } = $props();
  let global = $state("");
  let checked = $state(false);
  let v = $state(50);
  let text = $state("");
  useInput((e) => {
    if (e.is("space")) global += "S";
    if (e.key === "Enter") global += "E";
  });
</script>

<box height="100%">
  <txt>global:{global} checked:{checked} v:{v} text:{text}</txt>
  {#if mode === "checkbox"}
    <Checkbox bind:checked label="cb" autofocus />
  {:else if mode === "button"}
    <Button label="btn" autofocus />
  {:else if mode === "scroll"}
    <ScrollView height={3}>
      <Slider bind:value={v} width={20} />
      {#each Array.from({ length: 10 }, (_, i) => i) as i (i)}<txt>line {i}</txt>{/each}
    </ScrollView>
  {:else if mode === "input"}
    <TextInput bind:value={text} autofocus />
  {/if}
</box>
