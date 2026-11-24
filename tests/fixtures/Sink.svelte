<script lang="ts">
	import { Badge, Button, Checkbox, Divider, KeyHints, Panel, ProgressBar, Select, Tabs, TextInput, Table, ScrollView, Modal, Spinner } from '../../src/lib/index.ts';
	let tab = $state('one');
	let name = $state('');
	let done = $state(false);
	let fruit = $state('apple');
	let clicks = $state(0);
	let modal = $state(false);
</script>

<box height="100%">
	<Tabs items={['one', 'two', 'three']} bind:value={tab} />
	<box row gap={1} grow={1}>
		<Panel title="Form" width={30}>
			<TextInput bind:value={name} placeholder="Your name" prefix="> " autofocus />
			<Checkbox bind:checked={done} label="Done" />
			<Button label="Click" variant="primary" onclick={() => { clicks++; modal = true; }} />
			<txt>clicks: {clicks} name: {name}</txt>
			<ProgressBar value={0.42} showPercent />
			<Spinner label="loading" />
		</Panel>
		<Panel title="List" grow={1}>
			<Select items={[{ label: 'Apple', value: 'apple', hint: '3' }, { label: 'Banana', value: 'banana' }, { label: 'Cherry', value: 'cherry', disabled: true }, 'durian', 'elder']} bind:value={fruit} height={3} />
			<Divider title="table" />
			<Table columns={[{ key: 'a', title: 'Name' }, { key: 'b', title: 'Qty', align: 'right' }]} rows={[{ a: 'x', b: 1 }, { a: 'yy', b: 22 }]} />
			<Badge label="NEW" /> 
		</Panel>
	</box>
	<KeyHints hints={{ tab: 'next', q: 'quit' }} />
	{#if modal}
		<Modal title="Hello" onclose={() => (modal = false)}>
			<txt>Are you sure?</txt>
			<Button label="Close" onclick={() => (modal = false)} />
		</Modal>
	{/if}
</box>
