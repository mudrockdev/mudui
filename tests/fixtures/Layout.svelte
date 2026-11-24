<script lang="ts">
	let { variant }: { variant: string } = $props();
</script>

{#if variant === 'row-grow'}
	<box row>
		<txt>ab</txt>
		<box grow={1} bg="blue"><txt>mid</txt></box>
		<txt>cd</txt>
	</box>
{:else if variant === 'justify-between'}
	<box row justify="between"><txt>L</txt><txt>M</txt><txt>R</txt></box>
{:else if variant === 'center'}
	<box height={3} align="center" justify="center"><txt>hi</txt></box>
{:else if variant === 'border-padding'}
	<box border="single" padding="0 1" title="T" width={12}>
		<txt>a long line of text that wraps</txt>
	</box>
{:else if variant === 'gap'}
	<box gap={1}><txt>one</txt><txt>two</txt></box>
{:else if variant === 'percent'}
	<box row><box width="25%" bg="red"><txt>A</txt></box><box width="75%"><txt>B</txt></box></box>
{:else if variant === 'absolute'}
	<box height={4}>
		<txt>underneath text here</txt>
		<box position="absolute" top={1} left={2} width={5} border="ascii"><txt>X</txt></box>
	</box>
{:else if variant === 'scroll'}
	<box height={2} scrollY={1}><txt>row0</txt><txt>row1</txt><txt>row2</txt></box>
{:else if variant === 'truncate'}
	<box width={8}><txt wrap="truncate">abcdefghijkl</txt><txt wrap="truncate-start">abcdefghijkl</txt><txt wrap="truncate-middle">abcdefghijkl</txt></box>
{:else if variant === 'wide'}
	<box width={6}><txt>日本語テキスト</txt></box>
{:else if variant === 'inline-styles'}
	<txt>plain <txt bold color="red">bold</txt> <txt underline>u</txt></txt>
{:else if variant === 'style-attr'}
	<box style="border: round; padding: 0 2; width: 10"><txt>s</txt></box>
{:else if variant === 'hidden'}
	<box><txt>shown</txt><txt hidden>gone</txt><box hidden><txt>gone too</txt></box></box>
{:else if variant === 'loose-text'}
	<box row gap={1}>loose text <txt>and txt</txt></box>
{:else if variant === 'fill'}
	<box width={10}><txt fill="=">ab</txt><txt fill="-"></txt></box>
{:else if variant === 'margin'}
	<box border="single" width={9}><box margin={1}><txt>m</txt></box></box>
{/if}
