<script lang="ts">
  import { useApp } from "../runtime/context.js";
  import { dialogStore } from "../runtime/dialog.svelte.js";
  import { getTheme } from "../theme.js";
  import type { Dimension } from "../types.js";
  import Button from "./Button.svelte";
  import Modal from "./Modal.svelte";
  import TextInput from "./TextInput.svelte";

  let { width = 50 }: { width?: Dimension } = $props();

  const theme = getTheme();
  const store = dialogStore(useApp());
  const current = $derived(store.queue[0]);

  let input = $state("");
  let shown: unknown = null;

  // reset the prompt input for each new dialog
  $effect.pre(() => {
    if (current !== shown) {
      shown = current;
      input = current?.kind === "prompt" ? (current.initial ?? "") : "";
    }
  });

  function cancel() {
    store.answer(
      current?.kind === "confirm"
        ? false
        : current?.kind === "prompt"
          ? null
          : undefined,
    );
  }
</script>

{#if current}
  {#key current}
    <Modal
      title={current.title ??
        (current.kind === "confirm"
          ? "Confirm"
          : current.kind === "prompt"
            ? "Input"
            : "Notice")}
      borderColor={current.kind === "confirm" && current.danger
        ? theme.danger
        : theme.accent}
      {width}
      onclose={cancel}
    >
      <txt>{current.message}</txt>
      {#if current.kind === "confirm"}
        <box row gap={2}>
          <Button
            label={current.confirmLabel ?? "OK"}
            variant={current.danger ? "danger" : "primary"}
            autofocus
            onclick={() => store.answer(true)}
          />
          <Button
            label={current.cancelLabel ?? "Cancel"}
            onclick={() => store.answer(false)}
          />
        </box>
      {:else if current.kind === "prompt"}
        <TextInput
          bind:value={input}
          placeholder={current.placeholder}
          mask={current.mask}
          autofocus
          onsubmit={(v) => store.answer(v)}
          oncancel={() => store.answer(null)}
        />
      {:else}
        <Button
          label={current.okLabel ?? "OK"}
          variant="primary"
          autofocus
          onclick={() => store.answer()}
        />
      {/if}
    </Modal>
  {/key}
{/if}
