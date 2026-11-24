<script lang="ts">
  let { size }: { size?: number } = $props();
</script>

{#if size === undefined}
  <box grow={1}></box>
{:else}
  <box width={size} height={size}></box>
{/if}
