import { describe, expect, test } from "bun:test";
import { flushSync, mount, unmount } from "svelte";
import renderer from "../src/lib/renderer/index.ts";
import { TElement, TRoot, TText } from "../src/lib/renderer/nodes.ts";
import { computeLayout } from "../src/lib/renderer/layout.ts";
import { paintScreen } from "../src/lib/renderer/paint.ts";
import { renderTest } from "../src/lib/testing/index.ts";
import Counter from "./fixtures/Counter.svelte";

/** Renders a tree built by hand with the renderer API */
function draw(root: TElement, width: number, height: number) {
  return paintScreen(
    computeLayout(root, width, height),
    width,
    height,
  ).toString();
}

describe("custom renderer: node operations", () => {
  test("creates and inserts nodes, including fragments", () => {
    const root = new TRoot();
    const box = renderer.createElement("box");
    const fragment = renderer.createFragment();
    const a = renderer.createElement("txt");
    const b = renderer.createElement("txt");
    renderer.insert(a, renderer.createText("first"), null);
    renderer.insert(b, renderer.createText("second"), null);
    renderer.insert(fragment, a, null);
    renderer.insert(fragment, b, null);

    renderer.insert(box, fragment, null);
    renderer.insert(root, box, null);

    expect(renderer.getFirstChild(fragment)).toBeNull();
    expect(renderer.getFirstChild(box)).toBe(a);
    expect(renderer.getNextSibling(a)).toBe(b);
    expect(renderer.getParent(b)).toBe(box);
    expect(draw(root, 10, 2)).toBe("first\nsecond");

    // insert before an anchor, then remove
    const c = renderer.createElement("txt");
    renderer.insert(c, renderer.createText("zero"), null);
    renderer.insert(box, c, a);
    expect(draw(root, 10, 3)).toBe("zero\nfirst\nsecond");
    renderer.remove(a);
    expect(draw(root, 10, 3)).toBe("zero\nsecond");
    expect(renderer.getParent(a)).toBeNull();
  });

  test("attributes, text and node types", () => {
    const el = renderer.createElement("txt");
    const text = renderer.createText("x");
    const comment = renderer.createComment("anchor");
    expect(renderer.getNodeType(el)).toBe("element");
    expect(renderer.getNodeType(text)).toBe("text");
    expect(renderer.getNodeType(comment)).toBe("comment");
    expect(renderer.getNodeType(renderer.createFragment())).toBe("fragment");

    renderer.setAttribute(el, "width", 10);
    expect(renderer.getAttribute(el, "width")).toBe("10");
    expect(el.attributes.get("width")).toBe(10); // raw values are kept
    expect(renderer.hasAttribute(el, "width")).toBe(true);
    renderer.removeAttribute(el, "width");
    expect(renderer.hasAttribute(el, "width")).toBe(false);

    renderer.setText(text, "changed");
    expect(renderer.getText(text)).toBe("changed");
    expect(renderer.getText(comment)).toBe("anchor");
  });

  test("mutations notify the mounted root", () => {
    const root = new TRoot();
    let changes = 0;
    root.onchange = () => changes++;
    const el = renderer.createElement("txt");
    const text = renderer.createText("a") as TText;
    renderer.insert(el, text, null);
    expect(changes).toBe(0); // detached

    renderer.insert(root, el, null);
    expect(changes).toBe(1);
    renderer.setText(text, "b");
    renderer.setAttribute(el, "bold", true);
    expect(changes).toBe(3);
    renderer.setAttribute(el, "bold", true); // unchanged
    expect(changes).toBe(3);
  });

  test("event listeners", () => {
    const el = renderer.createElement("box");
    const handler = () => {};
    renderer.addEventListener(el, "click", handler);
    expect(el.hasListener("click")).toBe(true);
    renderer.removeEventListener(el, "click", handler);
    expect(el.hasListener("click")).toBe(false);
  });
});

describe("custom renderer: svelte integration", () => {
  test("mount() renders a compiled component into a mudui root", () => {
    const root = new TRoot();
    const component = mount(Counter, { target: root, renderer });
    flushSync();
    expect(draw(root, 20, 6)).toBe(
      "count: 0\n- alpha\n- beta\n- gamma\nless than two\nlog:",
    );
    unmount(component);
    flushSync();
    expect(root.first).toBeNull();
  });

  test("keyed each blocks reorder, remove and append nodes", () => {
    const t = renderTest(Counter, { width: 20, height: 8 });
    const items = () =>
      t
        .frame()
        .split("\n")
        .filter((l) => l.startsWith("- "));

    const before = [...t.app.root.descendants()].filter((el) =>
      el.textContent.startsWith("- "),
    );
    t.press("r");
    expect(items()).toEqual(["- gamma", "- beta", "- alpha"]);

    // keyed: the same nodes were moved, not recreated
    const after = [...t.app.root.descendants()].filter((el) =>
      el.textContent.startsWith("- "),
    );
    expect(new Set(after)).toEqual(new Set(before));

    t.press("x");
    expect(items()).toEqual(["- gamma", "- alpha"]);
    t.press("a");
    expect(items()).toEqual(["- gamma", "- alpha", "- delta"]);
    t.unmount();
  });

  test("if blocks swap branches and attributes update", () => {
    const t = renderTest(Counter, { width: 20, height: 8 });
    expect(t.frame()).toContain("less than two");
    t.press("+", "+");
    const frame = t.frame();
    expect(frame).toContain("count: 2");
    expect(frame).toContain("two or more");
    expect(frame).not.toContain("less than two");
    t.unmount();
  });

  test("event handlers receive events and update state", () => {
    const t = renderTest(Counter, { width: 30, height: 8 });
    t.press("+", "q");
    expect(t.frame()).toContain("log: box:+,box:q");
    t.clickText("count");
    expect(t.frame()).toContain("count: 2");
    t.unmount();
  });

  test("unmounting removes everything and stops listening", () => {
    const t = renderTest(Counter, { width: 20, height: 8 });
    t.unmount();
    expect(t.app.root.first).toBeNull();
    expect(t.app.exited).toBe(true);
    t.press("+"); // no throw
  });
});
