export const s = $state({
  value: "",
  query: "",
  items: [] as any[],
  chosen: "" as any,
  log: [] as string[],
});
export function reset(init: Partial<typeof s> = {}) {
  s.value = "";
  s.query = "";
  s.items = [];
  s.chosen = "";
  s.log = [];
  Object.assign(s, init);
}
