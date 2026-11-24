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
import type { BunPlugin } from 'bun';
import { dirname } from 'node:path';
import { compile, compileModule } from 'svelte/compiler';

export interface MuduiPluginOptions {
	/** Compile in dev mode (more checks, slower). Default `false`. */
	dev?: boolean;
	/**
	 * Decides the renderer per file: return `undefined` to use mudui, `null` to
	 * compile for the DOM, or a module path to use another custom renderer.
	 */
	renderer?: (filename: string) => string | null | undefined;
}

/** Absolute path of the renderer module (works from both `src` and `dist`) */
export const rendererPath = Bun.resolveSync('../renderer/index', import.meta.dir);

export function mudui(options: MuduiPluginOptions = {}): BunPlugin {
	const transpiler = new Bun.Transpiler({ loader: 'ts' });

	return {
		name: 'mudui-svelte',
		setup(build) {
			build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
				const source = await Bun.file(path).text();
				const custom = options.renderer?.(path);
				const result = compile(source, {
					filename: path,
					generate: 'client',
					dev: options.dev ?? false,
					css: 'external',
					experimental: {
						customRenderer: () => (custom === undefined ? rendererPath : custom)
					}
				});
				return { contents: result.js.code, loader: 'js', resolveDir: dirname(path) };
			});

			build.onLoad({ filter: /\.svelte\.(ts|js)$/ }, async ({ path }) => {
				let source = await Bun.file(path).text();
				if (path.endsWith('.ts')) source = transpiler.transformSync(source);
				const result = compileModule(source, {
					filename: path,
					generate: 'client',
					dev: options.dev ?? false
				});
				return { contents: result.js.code, loader: 'js', resolveDir: dirname(path) };
			});
		}
	};
}

export default mudui;
