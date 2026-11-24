<script lang="ts">
  import { Button } from "../../../src/lib/index.ts";
</script>

<Button
  label="Boom"
  autofocus
  onclick={() => {
    throw new Error("boom");
  }}
/>
