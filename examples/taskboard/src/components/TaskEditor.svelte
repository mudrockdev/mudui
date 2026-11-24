<!--
  Task details: a form in a modal. Edits are kept in local drafts and only
  applied on Save (or ctrl+s), so Escape throws them away.
-->
<script lang="ts">
  import {
    Button,
    Checkbox,
    Combobox,
    Modal,
    MultiSelect,
    RadioGroup,
    ScrollView,
    Slider,
    Spacer,
    TextArea,
    TextInput,
    getTheme,
    useTerminalSize,
    type KeyEvent,
  } from "mudui";
  import { untrack } from "svelte";
  import type { Priority, Task, TaskStore } from "../lib/tasks.svelte.ts";

  let {
    store,
    task,
    onclose,
  }: {
    store: TaskStore;
    task: Task;
    /** Called after saving (`true`) or cancelling (`false`) */
    onclose: (saved: boolean) => void;
  } = $props();

  const theme = getTheme();
  const size = useTerminalSize();
  /** Too narrow for two columns: stack the fields */
  const narrow = $derived(size.columns < 72);

  // the editor is created for one task, so the drafts start from its current values
  const initial = untrack(() => $state.snapshot(task));
  let title = $state(initial.title);
  let notes = $state(initial.notes ?? "");
  let priority = $state<Priority>(initial.priority);
  let tags = $state<string[]>(initial.tags ?? []);
  let estimate = $state(initial.estimate ?? 0);
  let done = $state(initial.done);
  let list = $state(initial.list);

  const priorities = [
    { label: "High", value: "high" as const, color: theme.danger },
    { label: "Normal", value: "normal" as const },
    { label: "Low", value: "low" as const, color: theme.muted },
  ];

  function save() {
    if (!title.trim()) return;
    store.update(task.id, {
      title,
      notes: notes.trim() ? notes : undefined,
      priority,
      tags: tags.length ? [...tags] : undefined,
      estimate: estimate || undefined,
      done,
      list,
    });
    onclose(true);
  }

  function onkeydown(event: KeyEvent) {
    if (event.is("ctrl+s")) {
      save();
      event.preventDefault();
      event.stopPropagation();
    }
  }
</script>

<Modal
  title="Task details"
  width={narrow ? "100%" : 76}
  onclose={() => onclose(false)}
>
  <box gap={1} {onkeydown}>
    <!-- the fields scroll when the terminal is short; the buttons stay put -->
    <ScrollView maxHeight={Math.max(4, size.rows - 8)} focusable={false}>
      <box row={!narrow} gap={narrow ? 1 : 3}>
        <box grow={1}>
          <txt bold>Title</txt>
          <TextInput
            bind:value={title}
            autofocus
            placeholder="What needs doing?"
          />
          {#if !title.trim()}
            <txt color={theme.danger}>A task needs a title</txt>
          {/if}
          <txt bold>Notes</txt>
          <TextArea
            bind:value={notes}
            height={5}
            lineNumbers={store.settings.lineNumbers}
            placeholder="Anything worth remembering"
            onsubmit={save}
          />
          <Slider
            bind:value={estimate}
            min={0}
            max={8}
            step={0.5}
            label="Estimate"
            showValue
            format={(v) => (v ? `${v}h` : "none")}
          />
          <Checkbox bind:checked={done} label="Done" />
        </box>
        <box width={narrow ? undefined : 26}>
          <txt bold>Priority</txt>
          <RadioGroup items={priorities} bind:value={priority} />
          <txt bold>Tags</txt>
          <MultiSelect items={store.tags} bind:value={tags} height={4} />
          <txt bold>List <txt color={theme.muted}>({list})</txt></txt>
          <Combobox
            items={store.lists}
            value={list}
            placeholder="Move to…"
            height={3}
            onselect={(value) => (list = value)}
          />
        </box>
      </box>
    </ScrollView>
    <box row gap={2}>
      <Button label="Save" variant="primary" onclick={save} />
      <Button label="Cancel" onclick={() => onclose(false)} />
      <Spacer />
      <txt color={theme.muted} wrap="truncate"
        >ctrl+s save · Esc cancel · Tab next field</txt
      >
    </box>
  </box>
</Modal>
