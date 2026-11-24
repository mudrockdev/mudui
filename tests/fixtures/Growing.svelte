<!-- Components that fill a sized parent (grow), between a header and a footer. -->
<script lang="ts">
  import {
    Badge,
    Button,
    LogView,
    ScrollView,
    Select,
    Slider,
    Toaster,
    Tree,
    type TreeNode,
  } from "../../src/lib/index.ts";

  let { which, count = 30 }: { which: string; count?: number } = $props();

  const lines = $derived(Array.from({ length: count }, (_, i) => `line ${i}`));
  const items = $derived(Array.from({ length: count }, (_, i) => `item ${i}`));
  const nodes = $derived<TreeNode[]>([
    {
      id: "root",
      label: "root",
      children: Array.from({ length: count }, (_, i) => ({
        id: `n${i}`,
        label: `node ${i}`,
      })),
    },
  ]);
  let expanded = $state(["root"]);
  let value = $state(0);
</script>

<box height="100%">
  <txt>header</txt>
  {#if which === "log"}
    <LogView {lines} grow={1} />
  {:else if which === "tree"}
    <Tree {nodes} bind:expanded grow={1} autofocus />
  {:else if which === "select"}
    <Select {items} grow={1} autofocus />
  {:else if which === "scroll"}
    <ScrollView grow={1} focusable={false}>
      {#each items as item (item)}<Button label={item} />{/each}
    </ScrollView>
  {:else if which === "maxheight"}
    <ScrollView maxHeight={5}>
      {#each items as item (item)}<txt>{item}</txt>{/each}
    </ScrollView>
  {:else if which === "squeeze"}
    <box row gap={1}>
      <Badge label="badge" />
      <Button label="Save" />
      <Slider bind:value label="Volume" showValue />
      <txt>a long text that has to give way to the others</txt>
    </box>
  {:else if which === "toasts"}
    <box grow={1}></box>
  {/if}
  <txt>footer</txt>
  <Toaster />
</box>
