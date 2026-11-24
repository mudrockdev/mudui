<script lang="ts">
  import { Button, KeyHints, Panel, useApp, useInput } from "mudui";

  const app = useApp();
  let count = $state(0);

  useInput((event) => {
    if (event.is("q")) app.exit();
  });
</script>

<box padding="1 2" gap={1}>
  <Panel title="Counter" width={32}>
    <txt>Count: <txt bold color="cyan">{count}</txt></txt>
    <Button
      label="Increment"
      variant="primary"
      autofocus
      onclick={() => count++}
    />
  </Panel>
  <KeyHints hints={{ enter: "increment", q: "quit" }} />
</box>
