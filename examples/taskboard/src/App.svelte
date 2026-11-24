<script lang="ts">
  import {
    CommandPalette,
    DialogHost,
    Toaster,
    useApp,
    useDialog,
    useInput,
    useToast,
    type Command,
  } from "mudui";
  import Activity from "./components/Activity.svelte";
  import Header from "./components/Header.svelte";
  import Help from "./components/Help.svelte";
  import Outline from "./components/Outline.svelte";
  import Settings from "./components/Settings.svelte";
  import Sidebar from "./components/Sidebar.svelte";
  import Stats from "./components/Stats.svelte";
  import StatusBar from "./components/StatusBar.svelte";
  import TaskEditor from "./components/TaskEditor.svelte";
  import TaskList from "./components/TaskList.svelte";
  import {
    sampleData,
    type Data,
    type Task,
    type TaskStore,
    type View,
  } from "./lib/tasks.svelte.ts";

  let {
    store,
    save,
    path,
    autosaveDelay,
  }: {
    store: TaskStore;
    /** Persists the data; called (debounced) whenever something changes */
    save: (data: Data) => Promise<void>;
    /** Where `save` writes, shown in the settings */
    path?: string;
    /** Overrides the autosave delay from the settings (ms) */
    autosaveDelay?: number;
  } = $props();

  const app = useApp();
  const toast = useToast();
  const dialog = useDialog();

  let view = $state<View>("tasks");
  let list = $state("");
  let saving = $state(false);
  /** A short status message for small things (toasts are for bigger news) */
  let message = $state("");
  /** The task open in the details editor */
  let details = $state<Task | null>(null);
  let palette = $state(false);
  /** A task for the task list to move its cursor to */
  let reveal = $state<string | null>(null);
  let task_list: ReturnType<typeof TaskList> | undefined = $state();

  let message_timer: ReturnType<typeof setTimeout> | undefined;
  function flash(text: string) {
    message = text;
    clearTimeout(message_timer);
    message_timer = setTimeout(() => (message = ""), 3000);
  }

  // autosave: whenever the data changes, save after a short pause
  /** The last saved JSON (initially, what was loaded) */
  let saved: string | null = null;
  let save_timer: ReturnType<typeof setTimeout> | undefined;

  async function save_now() {
    clearTimeout(save_timer);
    const data = store.toJSON();
    const json = JSON.stringify(data);
    saving = true;
    try {
      await save(data);
      saved = json;
      return true;
    } catch (error) {
      const message = `Could not save: ${(error as Error).message}`;
      store.log(message, "error");
      toast.error(message, { duration: 6000 });
      return false;
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    const json = JSON.stringify(store.toJSON());
    saved ??= json;
    if (json === saved) return;
    clearTimeout(save_timer);
    save_timer = setTimeout(
      save_now,
      autosaveDelay ?? store.settings.autosave * 1000,
    );
  });

  $effect(() => () => {
    clearTimeout(save_timer);
    clearTimeout(message_timer);
  });

  // select the first list, and keep the selection valid when lists are removed
  $effect.pre(() => {
    if (!store.lists.includes(list)) list = store.lists[0];
  });

  function go(to: View) {
    view = to;
  }

  async function delete_task(task: Task) {
    if (store.settings.confirmDelete) {
      const ok = await dialog.confirm(`Delete “${task.title}”?`, {
        title: "Delete task",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
    }
    store.remove(task.id);
    toast(`Deleted: ${task.title}`);
  }

  async function new_list() {
    const name = await dialog.prompt("Name of the new list", {
      title: "New list",
      placeholder: "List name",
    });
    if (name === null) return;
    const added = store.addList(name);
    if (!added) {
      toast.warning(
        name.trim() ? `“${name.trim()}” already exists` : "A list needs a name",
      );
      return;
    }
    list = added;
    view = "tasks";
    toast.success(`Created list ${added}`);
  }

  async function delete_list() {
    if (store.lists.length <= 1) {
      await dialog.alert("You can't delete the last list.", {
        title: "Delete list",
      });
      return;
    }
    const name = list;
    const count = store.tasksIn(name).length;
    const ok = await dialog.confirm(
      `Delete “${name}” and its ${count} tasks?`,
      {
        title: "Delete list",
        confirmLabel: "Delete",
        danger: true,
      },
    );
    if (!ok) return;
    store.removeList(name);
    toast(`Deleted list ${name}`);
  }

  async function reset() {
    const ok = await dialog.confirm(
      "Replace all lists and tasks with the sample data?",
      { title: "Reset", confirmLabel: "Reset", danger: true },
    );
    if (!ok) return;
    store.load(sampleData());
    store.log("Reset to the sample data", "delete");
    toast.warning("Reset to the sample data");
  }

  async function save_and_tell() {
    if (await save_now()) toast.success("Saved");
  }

  /** Runs a task-list command, switching to the task view first */
  function in_tasks(run: (list: ReturnType<typeof TaskList>) => void) {
    return () => {
      view = "tasks";
      // the task list mounts with the view; run once it exists
      queueMicrotask(() => task_list && run(task_list));
    };
  }

  const commands = $derived<Command[]>([
    {
      group: "Task",
      label: "Add a task",
      shortcut: "n",
      run: in_tasks((l) => l.startAdding()),
    },
    {
      group: "Task",
      label: "Open details",
      shortcut: "o",
      run: in_tasks((l) => l.openDetails()),
    },
    {
      group: "Task",
      label: "Toggle done",
      shortcut: "space",
      run: in_tasks((l) => l.toggleCurrent()),
    },
    {
      group: "Task",
      label: "Filter tasks",
      shortcut: "/",
      run: in_tasks((l) => l.startFiltering()),
    },
    {
      group: "Task",
      label: "Clear finished tasks",
      shortcut: "c",
      run: in_tasks((l) => l.clearDone()),
    },
    { group: "List", label: "New list", shortcut: "N", run: new_list },
    {
      group: "List",
      label: "Delete this list",
      shortcut: "D",
      run: delete_list,
    },
    ...(
      [
        ["Tasks", "tasks"],
        ["Outline", "outline"],
        ["Stats", "stats"],
        ["Activity", "activity"],
        ["Settings", "settings"],
        ["Help", "help"],
      ] as const
    ).map(([label, to], i) => ({
      group: "Go to",
      label,
      shortcut: String(i + 1),
      disabled: view === to,
      run: () => go(to),
    })),
    {
      group: "Settings",
      label: store.settings.showDone
        ? "Hide finished tasks"
        : "Show finished tasks",
      run: () => (store.settings.showDone = !store.settings.showDone),
    },
    ...(["manual", "priority", "title"] as const).map((sort) => ({
      group: "Settings",
      label: `Sort by ${sort === "manual" ? "manual order" : sort}`,
      disabled: store.settings.sort === sort,
      run: () => (store.settings.sort = sort),
    })),
    { group: "App", label: "Save now", shortcut: "ctrl+s", run: save_and_tell },
    { group: "App", label: "Reset to sample data", run: reset },
    { group: "App", label: "Quit", shortcut: "q", run: () => app.exit() },
  ]);

  const VIEW_KEYS: View[] = [
    "tasks",
    "outline",
    "stats",
    "activity",
    "settings",
    "help",
  ];

  useInput((event) => {
    const number = VIEW_KEYS[Number(event.key) - 1];
    if (event.is("q")) app.exit();
    else if (event.is("ctrl+p")) palette = true;
    else if (event.is("?")) view = view === "help" ? "tasks" : "help";
    else if (number && !event.ctrl && !event.alt) view = number;
    else if (event.is("N")) new_list();
    else if (event.is("D") && view === "tasks") delete_list();
    else if (event.is("ctrl+s")) save_and_tell();
    else if (event.key === "Escape" && view !== "tasks") view = "tasks";
    else return;
    event.preventDefault();
  });
</script>

<box height="100%">
  <Header {store} bind:view />

  {#if view === "tasks"}
    <box row grow={1}>
      <Sidebar {store} bind:list />
      <TaskList
        bind:this={task_list}
        {store}
        {list}
        bind:reveal
        ondelete={delete_task}
        ondetails={(task) => (details = task)}
        onstatus={flash}
      />
    </box>
  {:else if view === "outline"}
    <Outline
      {store}
      onopen={(task) => {
        list = task.list;
        view = "tasks";
        reveal = task.id;
      }}
    />
  {:else if view === "stats"}
    <Stats {store} />
  {:else if view === "activity"}
    <Activity {store} />
  {:else if view === "settings"}
    <Settings {store} {path} onreset={reset} />
  {:else}
    <Help />
  {/if}

  <StatusBar {saving} {message} {view} />

  {#if details}
    <TaskEditor
      {store}
      task={details}
      onclose={(saved) => {
        if (saved && details) toast.success(`Saved: ${details.title}`);
        details = null;
      }}
    />
  {/if}
  {#if palette}
    <CommandPalette {commands} onclose={() => (palette = false)} />
  {/if}
  <DialogHost />
  <Toaster />
</box>
