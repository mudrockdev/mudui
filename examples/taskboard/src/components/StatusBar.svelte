<script lang="ts">
	import { KeyHints, Spinner, getTheme } from 'mudui';

	let { message, saving }: { message: string; saving: boolean } = $props();

	const theme = getTheme();
</script>

<box row paddingX={1} gap={2}>
	<box grow={1}>
		<KeyHints hints={{ n: 'add', space: 'toggle', e: 'edit', d: 'delete', '/': 'filter', '?': 'help', q: 'quit' }} />
	</box>
	{#if saving}
		<Spinner label="saving" />
	{:else if message}
		<txt wrap="truncate" color={theme.success}>{message}</txt>
	{/if}
</box>
