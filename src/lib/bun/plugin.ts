/**
 * A Bun plugin that compiles Svelte components for the terminal.
 *
 * Every `.svelte` file is compiled with `experimental.customRenderer` pointing
 * at the mudui renderer module, so components render to mudui's node tree
 * instead of the DOM. `.svelte.ts` / `.svelte.js` modules are compiled too, so
 * runes work in shared state modules.
 *
 * It also makes Svelte load its client runtime (the one that supports custom
 * renderers), as the `svelte-custom-renderer` resolve condition would, so no
 * command-line flags are needed.
 */
import type { BunPlugin } from "bun";
import { compile, compileModule, parse } from "svelte/compiler";

export interface MuduiPluginOptions {
  /** Compile in dev mode (more checks, slower). Default `false`. */
  dev?: boolean;
  /**
   * Decides the renderer per file: return `undefined` to use mudui, `null` to
   * compile for the DOM, or a module path to use another custom renderer.
   */
  renderer?: (filename: string) => string | null | undefined;
}

/**
 * Gives template whitespace HTML semantics: a run of whitespace that contains a
 * line break becomes a single space. Formatters such as Prettier assume these
 * semantics and freely turn spaces into line breaks plus indentation, but in a
 * terminal a line break in text is a real line break. Only static text in the
 * template is affected: attribute values, `{expressions}` and scripts are left alone.
 */
export function normalizeWhitespace(source: string, filename?: string): string {
  if (!source.includes("\n")) return source;
  const ast = parse(source, { modern: true, filename });
  const ranges: Array<{ start: number; end: number; text: string }> = [];

  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    const n = node as Record<string, any>;
    if (n.type === "Fragment") {
      for (const child of n.nodes) {
        if (child.type === "Text") {
          const text = child.raw.replace(/[ \t]*\r?\n\s*/g, " ");
          if (text !== child.raw)
            ranges.push({ start: child.start, end: child.end, text });
        } else {
          visit(child);
        }
      }
      return;
    }
    for (const key in n) {
      // attribute values are Text nodes too, but they're not content
      if (key === "attributes" || key === "metadata" || key === "expression")
        continue;
      visit(n[key]);
    }
  };
  visit(ast.fragment);

  let out = source;
  for (const range of ranges.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, range.start) + range.text + out.slice(range.end);
  }
  return out;
}

/** The directory containing `file` */
const dirname = (file: string) => file.replace(/[\\/][^\\/]*$/, "") || "/";

/** `relative` resolved against the directory `dir`, as a native path */
const resolvePath = (dir: string, relative: string) =>
  Bun.fileURLToPath(new URL(relative, Bun.pathToFileURL(`${dir}/`)));

/**
 * Maps Svelte's server entry files to the client files that the
 * `svelte-custom-renderer` export condition would select, keyed by Svelte's root.
 */
const client_entries = new Map<string, Map<string, string>>();

/** The client file to load instead of `path`, if `path` is one of Svelte's server entries */
export async function clientEntry(path: string): Promise<string | undefined> {
  const root = /^(.*[\\/]svelte)[\\/]src[\\/]/.exec(path)?.[1];
  if (!root) return undefined;

  let map = client_entries.get(root);
  if (!map) {
    map = new Map();
    const { exports } = await Bun.file(`${root}/package.json`).json();
    for (const entry of Object.values<Record<string, unknown>>(exports ?? {})) {
      const client = entry?.["svelte-custom-renderer"];
      if (typeof client !== "string") continue;
      for (const condition of ["default", "worker"]) {
        const server = entry[condition];
        if (typeof server === "string" && server !== client) {
          map.set(resolvePath(root, server), resolvePath(root, client));
        }
      }
    }
    client_entries.set(root, map);
  }
  return map.get(Bun.fileURLToPath(Bun.pathToFileURL(path)));
}

/** Absolute path of the renderer module (works from both `src` and `dist`) */
export const rendererPath = Bun.resolveSync(
  "../renderer/index",
  import.meta.dir,
);

export function mudui(options: MuduiPluginOptions = {}): BunPlugin {
  const transpiler = new Bun.Transpiler({ loader: "ts" });

  return {
    name: "mudui-svelte",
    setup(build) {
      // Load Svelte's client runtime even without `--conditions=svelte-custom-renderer`:
      // Bun has no config option for conditions and plugins can't change how bare
      // specifiers like "svelte" resolve, but they can change what a resolved file contains.
      build.onLoad(
        { filter: /[\\/]svelte[\\/]src[\\/].*server\.js$/ },
        async ({ path }) => {
          const client = await clientEntry(path);
          return {
            contents: client
              ? `export * from ${JSON.stringify(client)};`
              : await Bun.file(path).text(),
            loader: "js",
            resolveDir: dirname(path),
          };
        },
      );

      build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
        const custom = options.renderer?.(path);
        // DOM components keep Svelte's usual whitespace handling
        const raw = await Bun.file(path).text();
        const source = custom === null ? raw : normalizeWhitespace(raw, path);
        const result = compile(source, {
          filename: path,
          generate: "client",
          dev: options.dev ?? false,
          css: "external",
          experimental: {
            customRenderer: () =>
              custom === undefined ? rendererPath : custom,
          },
        });
        return {
          contents: result.js.code,
          loader: "js",
          resolveDir: dirname(path),
        };
      });

      build.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async ({ path }) => {
        let source = await Bun.file(path).text();
        if (path.endsWith(".ts")) source = transpiler.transformSync(source);
        const result = compileModule(source, {
          filename: path,
          generate: "client",
          dev: options.dev ?? false,
        });
        return {
          contents: result.js.code,
          loader: "js",
          resolveDir: dirname(path),
        };
      });
    },
  };
}

export default mudui;
