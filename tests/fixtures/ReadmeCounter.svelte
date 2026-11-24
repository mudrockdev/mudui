<!-- The Counter example from README.md -->
<script lang="ts">
	import { Button, Panel, useInput, useApp } from '../../src/lib/index.ts';

	let count = $state(0);
	const app = useApp();

	useInput((event) => {
		if (event.is('q')) app.exit();
	});
</script>

<Panel title="Counter" width={30}>
	<txt>Count: <txt bold color="cyan">{count}</txt></txt>
	<Button label="Increment" variant="primary" autofocus onclick={() => count++} />
	<txt dim>q to quit</txt>
</Panel>
