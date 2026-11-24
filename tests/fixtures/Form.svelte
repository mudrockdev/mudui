<script lang="ts">
  import {
    Checkbox,
    Modal,
    Button,
    Select,
    Tabs,
    TextInput,
    ScrollView,
    Table,
  } from "../../src/lib/index.ts";

  let { show = "input" }: { show?: string } = $props();

  let text = $state("");
  let submitted = $state("");
  let checked = $state(false);
  let fruit = $state("apple");
  let chosen = $state("");
  let tab = $state("a");
  let modal = $state(false);
  let row = $state(0);
  const rows = Array.from({ length: 20 }, (_, i) => ({
    name: `item ${i}`,
    size: i * 10,
  }));
</script>

<box height="100%">
  {#if show === "input"}
    <TextInput
      bind:value={text}
      placeholder="type here"
      width={12}
      autofocus
      onsubmit={(v) => (submitted = v)}
    />
    <txt>value: [{text}] submitted: [{submitted}]</txt>
  {:else if show === "checkbox"}
    <Checkbox bind:checked label="Accept" autofocus />
    <txt>checked: {checked}</txt>
  {:else if show === "select"}
    <Select
      items={[
        "apple",
        "banana",
        { label: "Cherry", value: "cherry", disabled: true },
        "durian",
        "elderberry",
      ]}
      bind:value={fruit}
      height={3}
      autofocus
      onselect={(v) => (chosen = v)}
    />
    <txt>fruit: {fruit} chosen: {chosen}</txt>
  {:else if show === "tabs"}
    <Tabs
      items={[
        { label: "Alpha", value: "a" },
        { label: "Beta", value: "b" },
        { label: "Gamma", value: "c" },
      ]}
      bind:value={tab}
      autofocus
    />
    <txt>tab: {tab}</txt>
  {:else if show === "scroll"}
    <ScrollView height={4}>
      {#each Array.from({ length: 10 }, (_, i) => i) as i (i)}<txt>line {i}</txt
        >{/each}
    </ScrollView>
  {:else if show === "table"}
    <Table
      columns={[
        { key: "name", title: "Name" },
        { key: "size", title: "Size", align: "right" },
      ]}
      {rows}
      bind:selected={row}
      height={5}
      autofocus
    />
    <txt>row: {row}</txt>
  {:else if show === "modal"}
    <Button label="Open" autofocus onclick={() => (modal = true)} />
    <txt>modal: {modal}</txt>
    {#if modal}
      <Modal title="Confirm" onclose={() => (modal = false)}>
        <txt>Really?</txt>
        <box row gap={1}>
          <Button label="Yes" onclick={() => (modal = false)} />
          <Button label="No" onclick={() => (modal = false)} />
        </box>
      </Modal>
    {/if}
  {/if}
</box>
