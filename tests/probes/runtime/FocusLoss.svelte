<script lang="ts">
  import { untrack } from "svelte";
  import { Button, Panel, useInput } from "../../../src/lib/index.ts";

  let { disabledB = false, hiddenPanel = false }: { disabledB?: boolean; hiddenPanel?: boolean } = $props();
  let off = $state(untrack(() => disabledB));
  let hide = $state(untrack(() => hiddenPanel));

  useInput((event) => {
    if (event.is("ctrl+d")) off = !off;
    if (event.is("ctrl+x")) hide = !hide;
  });
</script>

<box>
  <Button label="A" />
  <Button label="B" disabled={off} />
  <box hidden={hide}>
    <Panel title="P"><Button label="C" /></Panel>
  </box>
</box>
