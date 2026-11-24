<script lang="ts">
  import { untrack } from "svelte";
  import { Modal, Button, useInput } from "../../../src/lib/index.ts";

  let { initiallyOpen = false }: { initiallyOpen?: boolean } = $props();
  let open = $state(untrack(() => initiallyOpen));
  let log = $state("");

  useInput((event) => {
    if (event.is("q")) log += "q";
    if (event.is("o")) open = true;
  });
</script>

<box height="100%">
  <txt>log:{log}</txt>
  {#if open}
    <Modal title="M" onclose={() => (open = false)}>
      <Button label="Inside" />
    </Modal>
  {/if}
</box>
