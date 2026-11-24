<script lang="ts">
	import { Panel, Table, type TableColumn } from 'mudui';

	type Row = { key: string; action: string };
	const columns: TableColumn<Row>[] = [
		{ key: 'key', title: 'Key', width: 14 },
		{ key: 'action', title: 'Action', grow: true }
	];
	const rows: Row[] = [
		{ key: 'Tab / S-Tab', action: 'Move focus between the lists, tasks and tabs' },
		{ key: '↑ ↓ / j k', action: 'Move the cursor' },
		{ key: 'n / a', action: 'Add tasks (Esc when done)' },
		{ key: 'space / x', action: 'Toggle done' },
		{ key: 'Enter / e', action: 'Edit the task' },
		{ key: 'p', action: 'Cycle priority (normal → high → low)' },
		{ key: 'J / K', action: 'Move the task down / up' },
		{ key: 'd / Del', action: 'Delete the task' },
		{ key: '/', action: 'Filter tasks' },
		{ key: 'c', action: 'Clear finished tasks' },
		{ key: 'N', action: 'New list' },
		{ key: '1 2 3', action: 'Switch between Tasks, Stats and Help' },
		{ key: 'ctrl+s', action: 'Save now (changes are saved automatically)' },
		{ key: 'q / ctrl+c', action: 'Quit' }
	];
</script>

<Panel title="Keys" grow={1}>
	<Table {columns} {rows} height={rows.length} />
	<txt> </txt>
	<txt color="gray">Mouse works too: click tabs, lists and tasks; click a checkbox to toggle; scroll with the wheel.</txt>
</Panel>
