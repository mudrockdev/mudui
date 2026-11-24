#!/usr/bin/env bun
/**
 * create-mudui: scaffolds a terminal app with Svelte and mudui.
 *
 *   bun create mudui my-app
 */
import { cp, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import pkg from './package.json' with { type: 'json' };

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

/** A valid npm package name derived from the directory name */
export function packageName(dir: string): string {
	const name = basename(resolve(dir))
		.toLowerCase()
		.replace(/[^a-z0-9._~-]+/g, '-')
		.replace(/^[._-]+|-+$/g, '');
	return name || 'mudui-app';
}

export interface Options {
	dir: string;
	mudui?: string;
}

/** Writes the project files into `dir`, which must be empty or not exist */
export async function create({ dir, mudui = `^${pkg.version}` }: Options): Promise<string> {
	const target = resolve(dir);
	const existing = await readdir(target).catch(() => []);
	if (existing.length > 0) throw new Error(`${dir} is not empty`);

	const name = packageName(target);
	await cp(join(import.meta.dir, 'template'), target, { recursive: true });
	// packing drops these files, so the template stores them under other names
	await rename(join(target, '_gitignore'), join(target, '.gitignore'));
	await rename(join(target, '_bunfig.toml'), join(target, 'bunfig.toml'));

	const readme = join(target, 'README.md');
	await writeFile(readme, (await readFile(readme, 'utf8')).replaceAll('{{name}}', name));

	const manifest = {
		name,
		version: '0.0.0',
		private: true,
		type: 'module',
		scripts: {
			dev: 'bun --conditions=svelte-custom-renderer --watch src/main.ts',
			start: 'bun --conditions=svelte-custom-renderer src/main.ts',
			test: 'bun --conditions=svelte-custom-renderer test'
		},
		dependencies: {
			mudui: mudui,
			svelte: pkg.config.svelte
		},
		devDependencies: {
			'@types/bun': pkg.config.typesBun
		}
	};
	await writeFile(join(target, 'package.json'), JSON.stringify(manifest, null, '\t') + '\n');

	return name;
}

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			install: { type: 'boolean', default: true },
			'no-install': { type: 'boolean' },
			mudui: { type: 'string' },
			help: { type: 'boolean', short: 'h' }
		}
	});

	if (values.help) {
		console.log(HELP);
		return;
	}

	let dir = positionals[0];
	if (!dir) {
		dir = prompt('Project directory:', 'mudui-app')?.trim() || 'mudui-app';
	}

	try {
		await create({ dir, mudui: values.mudui });
	} catch (error) {
		fail((error as Error).message);
	}

	const target = resolve(dir);

	if (values.install && !values['no-install']) {
		console.log(`\nInstalling dependencies…`);
		const proc = Bun.spawn(['bun', 'install'], { cwd: target, stdout: 'inherit', stderr: 'inherit' });
		if ((await proc.exited) !== 0) fail('bun install failed');
	}

	const cd = relative(process.cwd(), target);
	console.log(`\n${bold('Done!')} Next steps:\n`);
	if (cd) console.log(`  ${cyan(`cd ${cd.includes(' ') ? JSON.stringify(cd) : cd}`)}`);
	if (!values.install || values['no-install']) console.log(`  ${cyan('bun install')}`);
	console.log(`  ${cyan('bun run dev')}\n`);
}

if (import.meta.main) await main();
