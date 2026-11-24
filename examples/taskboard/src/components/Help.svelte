<!-- Keys and tips, in collapsible sections inside a scroll view. -->
<script lang="ts">
  import {
    Collapsible,
    Panel,
    ScrollView,
    Table,
    getTheme,
    type TableColumn,
  } from "mudui";

  const theme = getTheme();

  type Row = { key: string; action: string };
  const columns: TableColumn<Row>[] = [
    { key: "key", title: "Key", width: 14 },
    { key: "action", title: "Action", grow: true },
  ];
  const tasks: Row[] = [
    { key: "↑ ↓ / j k", action: "Move the cursor" },
    { key: "n / a", action: "Add tasks (Esc when done)" },
    { key: "space / x", action: "Toggle done" },
    { key: "Enter / e", action: "Edit the task" },
    { key: "o", action: "Task details: notes, tags, estimate, list" },
    { key: "p", action: "Cycle priority (normal → high → low)" },
    { key: "J / K", action: "Move the task down / up (manual order)" },
    { key: "d / Del", action: "Delete the task" },
    { key: "/", action: "Filter tasks" },
    { key: "c", action: "Clear finished tasks" },
  ];
  const app: Row[] = [
    {
      key: "Tab / S-Tab",
      action: "Move focus between the lists, tasks and tabs",
    },
    { key: "ctrl+p", action: "Command palette" },
    { key: "N / D", action: "New list / delete the current list" },
    { key: "1 – 6", action: "Switch between the views" },
    { key: "ctrl+s", action: "Save now (changes are saved automatically)" },
    { key: "q / ctrl+c", action: "Quit" },
  ];
</script>

<Panel title="Help" grow={1}>
  <ScrollView grow={1}>
    <Collapsible title="Tasks" open>
      <Table {columns} rows={tasks} height={tasks.length} focusable={false} />
    </Collapsible>
    <Collapsible title="Everywhere" open>
      <Table {columns} rows={app} height={app.length} focusable={false} />
    </Collapsible>
    <Collapsible title="Mouse">
      <txt
        >Click tabs, lists and tasks; click a checkbox to toggle; scroll with
        the wheel.</txt
      >
    </Collapsible>
    <Collapsible title="About">
      <txt
        >mudtasks is the test ground for <txt bold color={theme.accent}
          >mudui</txt
        >, a terminal renderer for Svelte 5. It uses every component of the kit.</txt
      >
    </Collapsible>
  </ScrollView>
</Panel>
