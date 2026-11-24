<script lang="ts">
  import type { Command, Dimension } from "../types.js";
  import Combobox from "./Combobox.svelte";
  import Modal from "./Modal.svelte";

  let {
    commands,
    title = "Commands",
    placeholder = "Type a command…",
    width = "60%",
    height = 8,
    onclose,
  }: {
    commands: Command[];
    title?: string;
    placeholder?: string;
    width?: Dimension;
    height?: number;
    /** Called on Escape, and after a command runs */
    onclose?: () => void;
  } = $props();

  const items = $derived(
    commands.map((command, i) => ({
      label: command.group
        ? `${command.group}: ${command.label}`
        : command.label,
      value: i,
      hint: command.shortcut,
      disabled: command.disabled,
    })),
  );

  function run(i: number) {
    onclose?.();
    commands[i]?.run();
  }
</script>

<Modal {title} {width} {onclose}>
  <Combobox {items} {placeholder} {height} autofocus onselect={run} />
</Modal>
