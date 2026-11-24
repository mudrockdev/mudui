<!-- Preferences, saved with the tasks. -->
<script lang="ts">
  import {
    Box,
    Button,
    Checkbox,
    Collapsible,
    Divider,
    Panel,
    RadioGroup,
    Slider,
    Switch,
    Text,
    getTheme,
  } from "mudui";
  import type { SortOrder, TaskStore } from "../lib/tasks.svelte.ts";

  let {
    store,
    path,
    onreset,
  }: {
    store: TaskStore;
    /** Where the data is saved, if anywhere */
    path?: string;
    /** Asks to replace everything with the sample data */
    onreset: () => void;
  } = $props();

  const theme = getTheme();

  const orders: Array<{ label: string; value: SortOrder; hint?: string }> = [
    { label: "Manual", value: "manual" },
    { label: "Priority", value: "priority" },
    { label: "Title", value: "title" },
  ];
</script>

<Panel title="Settings" grow={1} gap={1}>
  <Box>
    <Switch
      bind:checked={store.settings.showDone}
      label="Show finished tasks"
      autofocus
    />
    <Switch
      bind:checked={store.settings.confirmDelete}
      label="Ask before deleting a task"
    />
  </Box>

  <Box>
    <Divider title="Task order" />
    <RadioGroup
      items={orders}
      bind:value={store.settings.sort}
      direction="row"
    />
    <Text color={theme.muted}>J / K reorder tasks only in manual order.</Text>
  </Box>

  <Box>
    <Divider title="Saving" />
    <Slider
      bind:value={store.settings.autosave}
      min={0.2}
      max={5}
      step={0.1}
      width={44}
      label="Autosave after"
      showValue
      format={(v) => `${v.toFixed(1)}s`}
    />
  </Box>

  <Collapsible title="Advanced">
    <Checkbox
      bind:checked={store.settings.lineNumbers}
      label="Line numbers in task notes"
    />
    <Box row gap={1}>
      <Text color={theme.muted}>Data file</Text>
      <Text wrap="truncate-start">{path ?? "not saved (testing)"}</Text>
    </Box>
    <Button label="Reset to sample data…" variant="danger" onclick={onreset} />
  </Collapsible>
</Panel>
