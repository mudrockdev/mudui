<script lang="ts">
	import { Button, Modal, TextInput, getTheme, useApp, useInput } from 'mudui';
	import Header from './components/Header.svelte';
	import Help from './components/Help.svelte';
	import Sidebar from './components/Sidebar.svelte';
	import Stats from './components/Stats.svelte';
	import StatusBar from './components/StatusBar.svelte';
	import TaskList from './components/TaskList.svelte';
	import type { Data, Task, TaskStore, View } from './lib/tasks.svelte.ts';

	let {
		store,
		save,
		autosaveDelay = 500
	}: {
		store: TaskStore;
		/** Persists the data; called (debounced) whenever something changes */
		save: (data: Data) => Promise<void>;
		autosaveDelay?: number;
	} = $props();

	const app = useApp();
	const theme = getTheme();

	let view = $state<View>('tasks');
	let list = $state('');
	let message = $state('');
	let saving = $state(false);

	type Dialog = { kind: 'delete-task'; task: Task } | { kind: 'new-list' } | { kind: 'delete-list'; list: string };
	let dialog = $state<Dialog | null>(null);
	let new_list = $state('');

	// status messages fade after a few seconds
	let message_timer: ReturnType<typeof setTimeout> | undefined;
	function flash(text: string) {
		message = text;
		clearTimeout(message_timer);
		message_timer = setTimeout(() => (message = ''), 3000);
	}

	// autosave: whenever the data changes, save after a short pause
	/** The last saved JSON (initially, what was loaded) */
	let saved: string | null = null;
	let save_timer: ReturnType<typeof setTimeout> | undefined;

	async function save_now() {
		clearTimeout(save_timer);
		const data = store.toJSON();
		const json = JSON.stringify(data);
		saving = true;
		try {
			await save(data);
			saved = json;
		} catch (error) {
			flash(`Could not save: ${(error as Error).message}`);
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		const json = JSON.stringify(store.toJSON());
		saved ??= json;
		if (json === saved) return;
		clearTimeout(save_timer);
		save_timer = setTimeout(save_now, autosaveDelay);
	});

	$effect(() => () => {
		clearTimeout(save_timer);
		clearTimeout(message_timer);
	});

	// select the first list, and keep the selection valid when lists are removed
	$effect.pre(() => {
		if (!store.lists.includes(list)) list = store.lists[0];
	});

	useInput((event) => {
		if (event.is('q')) app.exit();
		else if (event.is('?')) view = view === 'help' ? 'tasks' : 'help';
		else if (event.is('1')) view = 'tasks';
		else if (event.is('2')) view = 'stats';
		else if (event.is('3')) view = 'help';
		else if (event.is('N')) {
			new_list = '';
			dialog = { kind: 'new-list' };
		} else if (event.is('D') && view === 'tasks') dialog = { kind: 'delete-list', list };
		else if (event.is('ctrl+s')) save_now().then(() => flash('Saved'));
		else if (event.key === 'Escape' && view !== 'tasks') view = 'tasks';
		else return;
		event.preventDefault();
	});

	function delete_task(task: Task) {
		store.remove(task.id);
		dialog = null;
		flash(`Deleted: ${task.title}`);
	}

	function add_list(name: string) {
		const added = store.addList(name);
		if (!added) {
			flash(name.trim() ? `“${name.trim()}” already exists` : 'A list needs a name');
			return;
		}
		list = added;
		view = 'tasks';
		dialog = null;
		flash(`Created list ${added}`);
	}
</script>

<box height="100%">
	<Header {store} bind:view />

	{#if view === 'tasks'}
		<box row grow={1}>
			<Sidebar {store} bind:list />
			<TaskList {store} {list} ondelete={(task) => (dialog = { kind: 'delete-task', task })} onstatus={flash} />
		</box>
	{:else if view === 'stats'}
		<Stats {store} />
	{:else}
		<Help />
	{/if}

	<StatusBar {message} {saving} />

	{#if dialog?.kind === 'delete-task'}
		{@const task = dialog.task}
		<Modal title="Delete task" borderColor={theme.danger} onclose={() => (dialog = null)}>
			<txt>Delete “{task.title}”?</txt>
			<box row gap={2}>
				<Button label="Delete" variant="danger" autofocus onclick={() => delete_task(task)} />
				<Button label="Cancel" onclick={() => (dialog = null)} />
			</box>
		</Modal>
	{:else if dialog?.kind === 'delete-list'}
		{@const name = dialog.list}
		<Modal title="Delete list" borderColor={theme.danger} onclose={() => (dialog = null)}>
			{#if store.lists.length <= 1}
				<txt>You can't delete the last list.</txt>
				<Button label="OK" autofocus onclick={() => (dialog = null)} />
			{:else}
				<txt>Delete “{name}” and its {store.tasksIn(name).length} tasks?</txt>
				<box row gap={2}>
					<Button
						label="Delete"
						variant="danger"
						autofocus
						onclick={() => {
							store.removeList(name);
							dialog = null;
							flash(`Deleted list ${name}`);
						}}
					/>
					<Button label="Cancel" onclick={() => (dialog = null)} />
				</box>
			{/if}
		</Modal>
	{:else if dialog?.kind === 'new-list'}
		<Modal title="New list" width={40} onclose={() => (dialog = null)}>
			<TextInput bind:value={new_list} placeholder="List name" autofocus onsubmit={add_list} oncancel={() => (dialog = null)} />
			<txt color={theme.muted}>Enter to create, Esc to cancel</txt>
		</Modal>
	{/if}
</box>
