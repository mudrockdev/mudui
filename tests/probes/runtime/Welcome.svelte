<script lang="ts">
  import { Button, Modal } from "../../../src/lib/index.ts";
  let welcome = $state(true);
</script>

<box height="100%">
  <Button label="Main" autofocus />
  <Button label="Other" />
  {#if welcome}
    <Modal title="Welcome" onclose={() => (welcome = false)}>
      <Button label="Got it" onclick={() => (welcome = false)} />
    </Modal>
  {/if}
</box>
