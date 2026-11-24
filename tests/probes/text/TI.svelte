<script lang="ts">
  import { TextInput } from "../../../src/lib/index.ts";
  import { s } from "./state.svelte.ts";
  let {
    width = 10,
    mask,
    maxLength,
    placeholder = "",
    prefix,
    disabled = false,
    autofocus = true,
    show = false,
  }: any = $props();
</script>

<box>
  <TextInput
    bind:value={s.value}
    {width}
    {mask}
    {maxLength}
    {placeholder}
    {prefix}
    {disabled}
    {autofocus}
  />
  {#if show}<txt>[{s.value}]</txt>{/if}
</box>
