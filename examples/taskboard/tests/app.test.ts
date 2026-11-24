import { describe, expect, test } from "bun:test";
import { renderTest } from "mudui/testing";
import App from "../src/App.svelte";
import { load, save } from "../src/lib/storage.ts";
import { TaskStore, sampleData, type Data } from "../src/lib/tasks.svelte.ts";

function setup(width = 90, height = 22) {
  const store = new TaskStore(sampleData());
  const saves: Data[] = [];
  const t = renderTest(App, {
    width,
    height,
    props: {
      store,
      save: async (data: Data) => void saves.push(data),
      autosaveDelay: 0,
    },
  });
  return { t, store, saves };
}

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mudtasks", () => {
  test("shows lists, tasks and progress", () => {
    const { t } = setup();
    const frame = t.frame();
    expect(frame).toContain("mudtasks");
    expect(frame).toContain("1/8 done");
    expect(frame).toMatch(/❯ Inbox\s+2/);
    expect(frame).toContain("Work");
    expect(frame).toContain("[ ] Try mudtasks");
    expect(frame).toContain("[✓] Toggle tasks with space");
    expect(frame).toContain("Inbox · 2 open");
    t.unmount();
  });

  test("the task list starts focused; space toggles, p cycles priority", () => {
    const { t, store } = setup();
    t.press("j", " ");
    expect(store.tasksIn("Inbox")[1].done).toBe(true);
    expect(t.frame()).toContain("2/8 done");
    expect(t.frame()).toContain("Done: Add a task with n");
    t.press("p");
    expect(store.tasksIn("Inbox")[1].priority).toBe("high");
    expect(t.frame()).toContain("!!");
    t.unmount();
  });

  test("adding tasks", () => {
    const { t, store } = setup();
    t.press("n");
    t.type("Water the plants");
    t.press("Enter");
    t.type("Feed the cat");
    t.press("Enter", "Escape");
    const titles = store.tasksIn("Inbox").map((task) => task.title);
    expect(titles.slice(-2)).toEqual(["Water the plants", "Feed the cat"]);
    expect(t.frame()).toContain("[ ] Feed the cat");
    // focus is back on the list: j/k move the cursor rather than typing
    t.press("k", " ");
    expect(store.find(store.tasksIn("Inbox")[3].id)!.done).toBe(true);
    t.unmount();
  });

  test("editing a task inline", () => {
    const { t, store } = setup();
    t.press("e", "ctrl+u");
    t.type("Renamed task");
    t.press("Enter");
    expect(store.tasksIn("Inbox")[0].title).toBe("Renamed task");
    expect(t.frame()).toContain("Renamed task");
    t.unmount();
  });

  test("deleting asks for confirmation", async () => {
    const { t, store } = setup();
    t.press("d");
    expect(t.frame()).toContain("Delete “Try mudtasks — press ? for help”?");
    t.press("Escape");
    await wait();
    expect(store.tasksIn("Inbox")).toHaveLength(3);
    t.press("d", "Enter");
    await wait();
    expect(store.tasksIn("Inbox")).toHaveLength(2);
    expect(t.frame()).toContain("Deleted: Try mudtasks");
    t.unmount();
  });

  test("reordering with J and K", () => {
    const { t, store } = setup();
    t.press("J", "J");
    expect(store.tasksIn("Inbox").map((task) => task.title)[2]).toBe(
      "Try mudtasks — press ? for help",
    );
    t.press("K");
    expect(store.tasksIn("Inbox").map((task) => task.title)[1]).toBe(
      "Try mudtasks — press ? for help",
    );
    t.unmount();
  });

  test("filtering", () => {
    const { t } = setup();
    t.press("/");
    t.type("space");
    const frame = t.frame();
    expect(frame).toContain("Toggle tasks with space");
    expect(frame).not.toContain("Add a task with n");
    t.press("Escape");
    expect(t.frame()).toContain("Add a task with n");
    t.unmount();
  });

  test("switching lists with the sidebar (keyboard and mouse)", () => {
    const { t } = setup();
    t.press("shift+Tab", "ArrowDown");
    expect(t.frame()).toContain("Work · 3 open");
    expect(t.frame()).toContain("Review pull requests");
    // the sidebar keeps focus while browsing lists
    t.press("ArrowDown");
    expect(t.frame()).toContain("Personal · 2 open");
    t.press("ArrowUp");
    expect(t.frame()).toContain("Work · 3 open");
    t.clickText("Personal");
    expect(t.frame()).toContain("Personal · 2 open");
    t.clickText("[ ] Buy groceries");
    t.unmount();
  });

  test("clicking a checkbox toggles the task", () => {
    const { t, store } = setup();
    const position = t.find("[ ] Add a task with n")!;
    t.click(position.x + 1, position.y);
    expect(store.tasksIn("Inbox")[1].done).toBe(true);
    t.unmount();
  });

  test("creating a list from a prompt", async () => {
    const { t, store } = setup();
    t.press("N");
    expect(t.frame()).toContain("New list");
    t.type("Garden");
    t.press("Enter");
    await wait();
    expect(store.lists).toEqual(["Inbox", "Work", "Personal", "Garden"]);
    expect(t.frame()).toContain("Garden · 0 open");
    expect(t.frame()).toContain("No tasks here. Press n to add one.");
    t.unmount();
  });

  test("stats and help views", () => {
    const { t } = setup();
    t.press("3");
    let frame = t.frame();
    expect(frame).toContain("Progress by list");
    expect(frame).toMatch(/Inbox .* 33%/);
    expect(frame).toMatch(/high\s+3\s+0/);
    t.press("?");
    frame = t.frame();
    expect(frame).toContain("Cycle priority");
    t.press("Escape");
    expect(t.frame()).toContain("Inbox · 2 open");
    t.unmount();
  });

  test("changes are saved automatically", async () => {
    const { t, saves } = setup();
    t.press(" ");
    await wait(20);
    expect(saves.length).toBeGreaterThan(0);
    expect(saves.at(-1)!.tasks[0].done).toBe(true);
    t.unmount();
  });

  test("q quits", () => {
    const { t } = setup();
    t.press("q");
    expect(t.app.exited).toBe(true);
  });

  test("task details: edit every field and save with ctrl+s", () => {
    const { t, store } = setup(100, 30);
    t.press("o");
    expect(t.frame()).toContain("Task details");
    t.press("End");
    t.type("!"); // title
    t.press("Tab");
    t.type("Call them first."); // notes
    t.press("Tab", "ArrowRight", "ArrowRight"); // estimate 1h
    t.press("Tab", " "); // done
    t.press("Tab", "ArrowDown"); // priority high → normal
    t.press("Tab", " "); // tag: bug
    t.press("Tab");
    t.type("work");
    t.press("Enter"); // move to Work
    t.press("ctrl+s");
    const task = store.tasks.find((t) => t.title.endsWith("!"))!;
    expect(task.title).toBe("Try mudtasks — press ? for help!");
    expect(task.notes).toBe("Call them first.");
    expect(task.estimate).toBe(1);
    expect(task.done).toBe(true);
    expect(task.priority).toBe("normal");
    expect(task.tags).toEqual(["bug"]);
    // a moved task goes to the end of its new list
    expect(store.tasksIn("Work").at(-1)).toBe(task);
    expect(t.frame()).not.toContain("Task details");
    t.unmount();
  });

  test("task details: Escape throws the changes away", () => {
    const { t, store } = setup(100, 30);
    t.press("o", "ctrl+u");
    t.type("Something else");
    t.press("Escape");
    expect(store.tasksIn("Inbox")[0].title).toBe(
      "Try mudtasks — press ? for help",
    );
    t.unmount();
  });

  test("task details fit a small terminal: one column, scrolling, buttons visible", () => {
    const { t } = setup(40, 16);
    t.press("o");
    expect(t.frame()).toContain("[ Save ]");
    for (let i = 0; i < 6; i++) t.press("Tab"); // down to the list field
    expect(t.frame()).toContain("Move to…");
    expect(t.frame()).toContain("[ Save ]");
    t.unmount();
  });

  test("toggling a task while finished tasks are hidden", () => {
    const { t, store } = setup();
    store.settings.showDone = false;
    t.press(" ", " ", " "); // each toggle hides the task under the cursor
    expect(store.tasksIn("Inbox").every((task) => task.done)).toBe(true);
    expect(t.frame()).toContain("All 3 tasks here are finished");
    t.unmount();
  });

  test("sorted by priority, the cursor follows a task whose priority changes", () => {
    const { t, store } = setup();
    store.settings.sort = "priority";
    t.press("shift+Tab", "ArrowDown", "Tab"); // Work: high, normal, low
    t.press("G", "p", "p"); // "Update dependencies": low → normal → high
    expect(store.visibleIn("Work")[1].title).toBe("Update dependencies");
    t.press("d");
    expect(t.frame()).toContain("Delete “Update dependencies”?");
    t.unmount();
  });

  test("the outline opens a task in the task view", () => {
    const { t } = setup();
    t.press("2");
    expect(t.frame()).toContain("Outline");
    t.press("End", "Enter");
    expect(t.frame()).toContain("Personal · 2 open");
    t.press(" "); // the cursor is on the task chosen in the outline
    expect(t.frame()).toContain("Done: Call the bank");
    t.unmount();
  });

  test("command palette", () => {
    const { t } = setup();
    t.press("ctrl+p");
    t.type("stats");
    t.press("Enter");
    expect(t.frame()).toContain("Progress by list");
    expect(t.frame()).not.toContain("Commands");
    t.unmount();
  });

  test("settings change the task view, and activity is logged", () => {
    const { t, store } = setup();
    t.press("5", " "); // Show finished tasks: off
    expect(store.settings.showDone).toBe(false);
    t.press("1");
    expect(t.frame()).not.toContain("Toggle tasks with space");
    t.press(" ");
    t.press("4");
    expect(t.frame()).toContain("Finished “Try mudtasks — press ? for help”");
    t.unmount();
  });

  test("settings and tags survive saving and loading", async () => {
    const path = `${import.meta.dir}/.tmp-${process.pid}.json`;
    try {
      const store = new TaskStore(sampleData());
      store.settings.sort = "title";
      store.tags.push("garden");
      await save(path, store.toJSON());
      const again = new TaskStore(await load(path));
      expect(again.settings.sort).toBe("title");
      expect(again.tags).toContain("garden");
    } finally {
      await Bun.file(path).delete();
    }
  });
});
