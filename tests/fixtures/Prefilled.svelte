<script lang="ts">
  import { TextInput } from "../../src/lib/index.ts";

  let short = $state("Call the bank");
  let long = $state("abcdefghijklmnopqrstuvwxyz");
</script>

<box>
  <TextInput bind:value={short} width={20} autofocus />
  <TextInput bind:value={long} width={12} />
</box>
