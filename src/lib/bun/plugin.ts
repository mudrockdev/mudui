/**
 * A Bun plugin that compiles Svelte components for the terminal.
 *
 * Every `.svelte` file is compiled with `experimental.customRenderer` pointing
 * at the mudui renderer module, so components render to mudui's node tree
 * instead of the DOM. `.svelte.ts` / `.svelte.js` modules are compiled too, so
 * runes work in shared state modules.
 *
 * Svelte's client runtime must be selected with the `svelte-custom-renderer`
 * resolve condition: run Bun with `--conditions=svelte-custom-renderer`.
 */
import type { BunPlugin } from "bun";
import { dirname } from "node:path";
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
