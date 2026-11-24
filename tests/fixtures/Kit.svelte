<script lang="ts">
  import {
    BarChart,
    Collapsible,
    Combobox,
    CommandPalette,
    DialogHost,
    LogView,
    MultiSelect,
    RadioGroup,
    Slider,
    Sparkline,
    Switch,
    TextArea,
    Toaster,
    Tree,
    useDialog,
    useInput,
    useToast,
    type TreeNode,
  } from "../../src/lib/index.ts";

  let { show, logLines = 0 }: { show: string; logLines?: number } = $props();

  let text = $state("");
  let submitted = $state("");
  let on = $state(false);
  let size = $state("m");
  let toppings = $state<string[]>([]);
  let volume = $state(50);
  let open = $state(false);
  let picked = $state("");
  let palette = $state(false);
  let ran = $state("");
  let selected = $state<string>();
  let expanded = $state<string[]>([]);
  let chosen = $state("");
  let answer = $state("");

  const toast = useToast();
  const dialog = useDialog();

  useInput((event) => {
    if (event.is("ctrl+t")) toast.success("Saved!", { duration: 0 });
    if (event.is("ctrl+y"))
      toast.error("Failed", { title: "Upload", duration: 0 });
    if (event.is("ctrl+o"))
      dialog
        .confirm("Delete it?", { danger: true })
        .then((v) => (answer = `confirm:${v}`));
    if (event.is("ctrl+p") && show === "dialog")
      dialog
        .prompt("Your name?", { initial: "Al" })
        .then((v) => (answer = `prompt:${v}`));
    if (event.is("ctrl+k") && show === "palette") palette = true;
  });

  const tree: TreeNode[] = [
    {
      id: "src",
      label: "src",
      children: [
        {
          id: "lib",
          label: "lib",
          children: [{ id: "index", label: "index.ts" }],
        },
        { id: "app", label: "app.ts" },
      ],
    },
    { id: "readme", label: "README.md" },
  ];

  const log = $derived(Array.from({ length: logLines }, (_, i) => `line ${i}`));
</script>

<box height="100%">
  {#if show === "textarea"}
    <TextArea
      bind:value={text}
      height={3}
      width={12}
      autofocus
      lineNumbers
      onsubmit={(v) => (submitted = v)}
    />
    <txt
      >value: {JSON.stringify(text)} submitted: {JSON.stringify(submitted)}</txt
    >
  {:else if show === "switch"}
    <Switch bind:checked={on} label="Wi-Fi" autofocus />
    <txt>on: {on}</txt>
  {:else if show === "radio"}
    <RadioGroup
      items={[
        { label: "Small", value: "s" },
        { label: "Medium", value: "m" },
        { label: "Large", value: "l", disabled: true },
        { label: "Huge", value: "h" },
      ]}
      bind:value={size}
      autofocus
    />
    <txt>size: {size}</txt>
  {:else if show === "multi"}
    <MultiSelect
      items={[
        "cheese",
        "olives",
        { label: "anchovies", value: "anchovies", disabled: true },
        "basil",
      ]}
      bind:value={toppings}
      autofocus
    />
    <txt>toppings: {toppings.join(",")}</txt>
  {:else if show === "slider"}
    <Slider
      bind:value={volume}
      min={0}
      max={100}
      step={5}
      label="Vol"
      width={30}
      autofocus
    />
    <txt>volume: {volume}</txt>
  {:else if show === "collapsible"}
    <Collapsible title="Details" bind:open autofocus
      ><txt>hidden content</txt></Collapsible
    >
    <txt>open: {open}</txt>
  {:else if show === "combobox"}
    <Combobox
      items={["apple", "apricot", "banana", "blueberry", "cherry", "grape"]}
      height={4}
      autofocus
      onselect={(v) => (picked = v)}
    />
    <txt>picked: {picked}</txt>
  {:else if show === "palette"}
    <txt>ran: {ran}</txt>
    {#if palette}
      <CommandPalette
        commands={[
          {
            label: "Open file",
            group: "File",
            shortcut: "ctrl+o",
            run: () => (ran = "open"),
          },
          { label: "Save", group: "File", run: () => (ran = "save") },
          { label: "Toggle theme", run: () => (ran = "theme") },
        ]}
        onclose={() => (palette = false)}
      />
    {/if}
  {:else if show === "tree"}
    <Tree
      nodes={tree}
      bind:selected
      bind:expanded
      autofocus
      onselect={(n) => (chosen = n.label)}
    />
    <txt
      >selected: {selected} expanded: {expanded.join(",")} chosen: {chosen}</txt
    >
  {:else if show === "log"}
    <LogView lines={log} height={3} />
  {:else if show === "charts"}
    <Sparkline data={[1, 2, 3, 4, 5, 6, 7, 8]} />
    <Sparkline data={[5, 5, 5, 1, 9]} width={8} />
    <BarChart
      data={[
        { label: "cpu", value: 50 },
        { label: "memory", value: 100 },
        { label: "io", value: 0 },
      ]}
    />
  {:else if show === "toast" || show === "dialog"}
    <txt>answer: {answer}</txt>
  {/if}
  <Toaster />
  <DialogHost />
</box>
