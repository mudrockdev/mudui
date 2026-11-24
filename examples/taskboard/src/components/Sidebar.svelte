<script lang="ts">
	import { Panel, Select } from 'mudui';
	import type { TaskStore } from '../lib/tasks.svelte.ts';

	let { store, list = $bindable() }: { store: TaskStore; list: string } = $props();

	const items = $derived(
		store.lists.map((name) => {
			const open = store.openCount(name);
			return { label: name, value: name, hint: open ? String(open) : '' };
		})
	);
</script>

<Panel title="Lists" width={24}>
	<Select {items} bind:value={list} height={Math.max(1, store.lists.length)} />
</Panel>
