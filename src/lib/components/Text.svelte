<script lang="ts">
  import type { TxtAttributes } from "../types.js";

  let { children, ...rest }: TxtAttributes = $props();
</script>

<txt {...rest}>{@render children?.()}</txt>
