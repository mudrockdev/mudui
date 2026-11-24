<script lang="ts">
  import type { BoxAttributes } from "../types.js";

  let { children, ...rest }: BoxAttributes = $props();
</script>

<box {...rest}>{@render children?.()}</box>
