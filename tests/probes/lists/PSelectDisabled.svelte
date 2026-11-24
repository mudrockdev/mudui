<script lang="ts">
  import { untrack } from "svelte";
  import { Select } from "../../../src/lib/index.ts";
  let value = $state("b");
</script>

<box height="100%">
  <Select items={["a", "b", "c", "d"]} bind:value disabled />
  <txt>value: {value}</txt>
</box>
