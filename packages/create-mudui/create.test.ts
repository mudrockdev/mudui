import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create, packageName } from './index.ts';

const root = await mkdtemp(join(tmpdir(), 'create-mudui-'));
afterAll(() => rm(root, { recursive: true, force: true }));

describe('create-mudui', () => {
	test('scaffolds a minimal project', async () => {
		const dir = join(root, 'My App');
		const name = await create({ dir });
		expect(name).toBe('my-app');

		const files = (await readdir(dir, { recursive: true })).sort();
		expect(files).toEqual([
			'.gitignore',
			'README.md',
			'bunfig.toml',
			'package.json',
			'src',
			'src/App.svelte',
			'src/main.ts',
			'svelte.config.js',
			'tests',
			'tests/App.test.ts',
			'tsconfig.json'
		]);

		const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
		expect(manifest.name).toBe('my-app');
		expect(Object.keys(manifest.dependencies)).toEqual(['mudui', 'svelte']);
		expect(Object.keys(manifest.devDependencies)).toEqual(['@types/bun']);
		expect(manifest.scripts.start).toContain('--conditions=svelte-custom-renderer');
		expect(await readFile(join(dir, 'README.md'), 'utf8')).toStartWith('# my-app\n');
	});

	test('uses the given mudui specifier', async () => {
		const dir = join(root, 'custom');
		await create({ dir, mudui: 'file:../mudui.tgz' });
		const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
		expect(manifest.dependencies.mudui).toBe('file:../mudui.tgz');
	});

	test('refuses to overwrite a non-empty directory', async () => {
		const dir = join(root, 'taken');
		await create({ dir });
		await writeFile(join(dir, 'extra'), '');
		expect(create({ dir })).rejects.toThrow('is not empty');
	});

	test('package names', () => {
		expect(packageName('/x/Hello World!')).toBe('hello-world');
		expect(packageName('/x/__')).toBe('mudui-app');
		expect(packageName('/x/tui.app')).toBe('tui.app');
	});
});
