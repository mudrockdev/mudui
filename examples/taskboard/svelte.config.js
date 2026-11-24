// Used by editors and svelte-check: these components render to the terminal.
// (At runtime, the `mudui/preload` Bun plugin compiles them the same way.)
export default {
	compilerOptions: {
		runes: true,
		experimental: { customRenderer: 'mudui/renderer' }
	}
};
