<script lang="ts">
	import { Badge, ProgressBar, Tabs } from 'mudui';
	import type { TaskStore, View } from '../lib/tasks.svelte.ts';

	let { store, view = $bindable() }: { store: TaskStore; view: View } = $props();

	const total = $derived(store.tasks.length);
	const done = $derived(store.doneCount);
</script>

<box row gap={2} paddingX={1}>
	<Badge label="mudtasks" />
	<Tabs
		items={[
			{ label: 'Tasks', value: 'tasks' },
			{ label: 'Stats', value: 'stats' },
			{ label: 'Help', value: 'help' }
		]}
		bind:value={view}
	/>
	<box grow={1}></box>
	<txt wrap="none">{done}/{total} done</txt>
	<ProgressBar value={done} max={total || 1} width={16} />
</box>
