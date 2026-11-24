#!/usr/bin/env bun
/**
 * create-mudui: scaffolds a terminal app with Svelte and mudui.
 *
 *   bun create mudui my-app
 */
import pkg from "./package.json" with { type: "json" };

const HELP = `
Usage: bun create mudui [dir] [options]

Options:
  --no-install     Skip installing dependencies
  --mudui <spec>   mudui version or specifier to depend on (default: ^${pkg.version})
  -h, --help       Show this help
`;

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[39m`;
const red = (s: string) => `\x1b[31m${s}\x1b[39m`;

function fail(message: string): never {
  console.error(red(`error: ${message}`));
  process.exit(1);
}

/** `path` made absolute against the current directory (works with `/` and `\` separators) */
export function absolute(path: string): string {
  const url = /^([a-zA-Z]:)?[\\/]/.test(path)
    ? Bun.pathToFileURL(path)
    : new URL(
        path.split(/[\\/]/).map(encodeURIComponent).join("/"),
        Bun.pathToFileURL(`${process.cwd()}/`),
      );
  return Bun.fileURLToPath(url).replace(/(.)[\\/]+$/, "$1");
}

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? "";

/** A valid npm package name derived from the directory name */
export function packageName(dir: string): string {
  const name = basename(absolute(dir))
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/^[._-]+|-+$/g, "");
  return name || "mudui-app";
}

function isEmpty(dir: string): boolean {
  try {
    for (const _ of new Bun.Glob("*").scanSync({ cwd: dir, dot: true, onlyFiles: false })) return false;
  } catch {
    // doesn't exist yet
  }
  return true;
}

/** Packing drops these files, so the template stores them under other names */
const RENAMES: Record<string, string> = {
  _gitignore: ".gitignore",
  "_bunfig.toml": "bunfig.toml",
};

export interface Options {
  dir: string;
  mudui?: string;
}

/** Writes the project files into `dir`, which must be empty or not exist */
export async function create({ dir, mudui = `^${pkg.version}` }: Options): Promise<string> {
  const target = absolute(dir);
  if (!isEmpty(target)) throw new Error(`${dir} is not empty`);

  const name = packageName(target);
  const template = `${import.meta.dir}/template`;

  for (const file of new Bun.Glob("**/*").scanSync({ cwd: template, dot: true })) {
    const path = file.replaceAll("\\", "/");
    const source = Bun.file(`${template}/${path}`);
    const out = `${target}/${RENAMES[path] ?? path}`;
    if (path === "README.md") {
      await Bun.write(out, (await source.text()).replaceAll("{{name}}", name));
    } else {
      await Bun.write(out, source);
    }
  }

  const manifest = {
    name,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "bun --watch src/main.ts",
      start: "bun src/main.ts",
      test: "bun test",
      "build:windows": "bun build.ts windows",
      "build:linux": "bun build.ts linux",
      "build:darwin": "bun build.ts darwin",
    },
    dependencies: {
      mudui,
      svelte: pkg.config.svelte,
    },
    devDependencies: {
      "@types/bun": pkg.config.typesBun,
    },
  };
  await Bun.write(`${target}/package.json`, JSON.stringify(manifest, null, "\t") + "\n");

  return name;
}

function parseArgs(argv: string[]) {
  const args = { help: false, install: true, mudui: undefined as string | undefined, dir: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg === "--no-install") args.install = false;
    else if (arg === "--mudui") args.mudui = argv[++i] ?? fail("--mudui needs a value");
    else if (arg.startsWith("--mudui=")) args.mudui = arg.slice("--mudui=".length);
    else if (arg.startsWith("-")) fail(`unknown option ${arg}\n${HELP}`);
    else if (args.dir === undefined) args.dir = arg;
    else fail(`unexpected argument ${arg}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(Bun.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return;
  }

  const dir = args.dir ?? (prompt("Project directory:", "mudui-app")?.trim() || "mudui-app");

  try {
    await create({ dir, mudui: args.mudui });
  } catch (error) {
    fail((error as Error).message);
  }

  if (args.install) {
    console.log(`\nInstalling dependencies…`);
    const proc = Bun.spawn(["bun", "install"], {
      cwd: absolute(dir),
      stdout: "inherit",
      stderr: "inherit",
    });
    if ((await proc.exited) !== 0) fail("bun install failed");
  }

  console.log(`\n${bold("Done!")} Next steps:\n`);
  if (absolute(dir) !== absolute(".")) {
    console.log(`  ${cyan(`cd ${dir.includes(" ") ? JSON.stringify(dir) : dir}`)}`);
  }
  if (!args.install) console.log(`  ${cyan("bun install")}`);
  console.log(`  ${cyan("bun run dev")}\n`);
}

if (import.meta.main) await main();
