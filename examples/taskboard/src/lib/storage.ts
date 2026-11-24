import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, rename } from "node:fs/promises";
import { sampleData, type Data } from "./tasks.svelte.ts";

/** `$MUDTASKS_FILE`, or `$XDG_DATA_HOME/mudtasks/tasks.json` */
export function defaultPath(): string {
  if (process.env.MUDTASKS_FILE) return process.env.MUDTASKS_FILE;
  const base = process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "mudtasks", "tasks.json");
}

export async function load(path: string): Promise<Data> {
  const file = Bun.file(path);
  if (!(await file.exists())) return sampleData();
  const data = (await file.json()) as Partial<Data>;
  return {
    lists: Array.isArray(data.lists) ? data.lists : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  };
}

/** Writes atomically, so a crash never leaves a half-written file */
export async function save(path: string, data: Data): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await Bun.write(temp, JSON.stringify(data, null, "\t"));
  await rename(temp, path);
}
