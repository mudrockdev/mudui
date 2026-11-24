import { expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import FocusLoss from "./FocusLoss.svelte";
import ModalShadow from "./ModalShadow.svelte";

test.failing("disabling the focused Button: it no longer looks focused", () => {
  const t = renderTest(FocusLoss, { width: 20, height: 8 });
  t.press("Tab", "Tab"); // focus B
  t.press("ctrl+d"); // disable B -> focus falls back to A
  const fresh = renderTest(FocusLoss, {
    width: 20,
    height: 8,
    props: { disabledB: true },
  });
  fresh.press("Tab"); // A focused, B disabled
  // actual: both A and B render with the focused look ("  A" / "  B")
  expect(t.frame()).toBe(fresh.frame());
  t.unmount();
  fresh.unmount();
});

test.failing(
  "hiding the focused element: it does not keep its focused look when shown again",
  () => {
    const t = renderTest(FocusLoss, { width: 20, height: 8 });
    t.press("Tab", "Tab", "Tab"); // focus C (inside Panel)
    t.press("ctrl+x"); // hide C's container -> focus falls back to B
    t.press("ctrl+x"); // show again
    const fresh = renderTest(FocusLoss, { width: 20, height: 8 });
    fresh.press("Tab", "Tab"); // B focused
    expect(t.frame()).toBe(fresh.frame()); // actual: C still drawn as "  C" (focused)
    t.unmount();
    fresh.unmount();
  },
);

test.failing(
  "hiding the focused element: the Panel around it stops highlighting",
  () => {
    const t = renderTest(FocusLoss, { width: 20, height: 8 });
    t.press("Tab", "Tab", "Tab"); // focus C (inside Panel)
    t.press("ctrl+x"); // hide -> focus falls back to B
    t.press("ctrl+x"); // show again
    const fresh = renderTest(FocusLoss, { width: 20, height: 8 });
    fresh.press("Tab", "Tab");
    // actual: border stays accent (fg 6) because focusout never fired
    const corner = t.find("╭")!;
    const freshCorner = fresh.find("╭")!;
    expect(t.screen().styleAt(corner.x, corner.y)).toEqual(
      fresh.screen().styleAt(freshCorner.x, freshCorner.y),
    );
    t.unmount();
    fresh.unmount();
  },
);

test.failing(
  "Modal shadows global handlers when it is open from the first render",
  () => {
    const t = renderTest(ModalShadow, {
      width: 30,
      height: 10,
      props: { initiallyOpen: true },
    });
    expect(t.frame()).toContain("Inside");
    t.press("q");
    expect(t.frame().split("\n")[0]).toBe("log:"); // actual: "log:q"
    t.unmount();
  },
);

import Welcome from "./Welcome.svelte";

test.failing(
  "autofocus element behind a modal that is open on startup gets focus once the modal closes",
  () => {
    const t = renderTest(Welcome, { width: 40, height: 12 });
    expect(t.focused()?.textContent?.trim()).toBe("Got it");
    t.press("Enter");
    expect(t.frame()).not.toContain("Welcome");
    // actual: nothing is focused (autofocus was consumed while the trap was active)
    expect(t.focused()?.textContent?.trim()).toBe("Main");
    t.unmount();
  },
);
