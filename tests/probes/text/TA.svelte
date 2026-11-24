<script lang="ts">
  import { TextArea } from "../../../src/lib/index.ts";
  import { s } from "./state.svelte.ts";
  let { width = 10, height = 3, lineNumbers = false, maxLength, placeholder = "", disabled = false, autofocus = true, insertTabs = false }: any = $props();
</script>

<box>
  <TextArea bind:value={s.value} {width} {height} {lineNumbers} {maxLength} {placeholder} {disabled} {autofocus} {insertTabs} />
</box>
