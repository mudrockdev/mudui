#!/usr/bin/env bun
/**
 * mudtasks — a terminal task manager built with mudui.
 *
 *   bun start [path/to/tasks.json]
 */
import { render } from "mudui";
import App from "./App.svelte";
import { defaultPath, load, save } from "./lib/storage.ts";
import { TaskStore } from "./lib/tasks.svelte.ts";

const path = process.argv[2] ?? defaultPath();
const store = new TaskStore(await load(path));
store.log(`Opened ${path} (${store.tasks.length} tasks)`);

const app = render(App, {
  props: { store, path, save: (data) => save(path, data) },
});

try {
  await app.waitUntilExit();
} finally {
  // whatever happens, don't lose the last changes
  await save(path, store.toJSON());
}

console.log(`Saved ${store.tasks.length} tasks to ${path}`);
