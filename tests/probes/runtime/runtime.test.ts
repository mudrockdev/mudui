import { expect, test } from "bun:test";
import { App } from "../../../src/lib/runtime/app.ts";
import { VirtualTerminal } from "../../../src/lib/runtime/terminal.ts";
import { InputParser } from "../../../src/lib/runtime/input.ts";
import InlineOnce from "./InlineOnce.svelte";
import { TermEmu } from "./TermEmu.ts";

test.failing(
  "horizontal wheel (SGR buttons 66/67) is not reported as wheeldown",
  () => {
    const events = new InputParser().feed(
      "\x1b[<65;5;5M\x1b[<66;5;5M\x1b[<67;5;5M",
    );
    const actions = events.map((e) => (e.kind === "mouse" ? e.action : e.kind));
    expect(actions[0]).toBe("wheeldown");
    // wheel left / right must not scroll vertically
    expect(actions[1]).not.toBe("wheeldown");
    expect(actions[2]).not.toBe("wheeldown");
  },
);

test.failing(
  "inline app that exits in onMount (print once and quit) leaves its output on screen",
  async () => {
    const terminal = new VirtualTerminal(30, 10);
    const app = new App(InlineOnce, {
      terminal,
      fullscreen: false,
      handleErrors: false,
    });
    await app.waitUntilExit();
    const emu = new TermEmu(30);
    emu.write(terminal.output);
    // actual output is just "\r\x1b[K": the final frame is never painted
    expect(emu.toString()).toBe("line one\nline two");
  },
);

test.failing(
  "exit() during a render (onMount) writes nothing after the terminal was restored",
  async () => {
    class Marked extends VirtualTerminal {
      restore() {
        this.output += "<RESTORE>";
      }
    }
    const terminal = new Marked(30, 5);
    const app = new App(InlineOnce, {
      terminal,
      fullscreen: true,
      handleErrors: false,
    });
    await app.waitUntilExit();
    const after = terminal.output.slice(
      terminal.output.indexOf("<RESTORE>") + "<RESTORE>".length,
    );
    // actual: a full-screen diff (blanking the user's main screen) is written after restore
    expect(after).toBe("");
  },
);

test.failing(
  "renderTest: an error thrown in an event handler fails that test instead of killing the test process",
  () => {
    // crash_case.ts presses Enter on a Button whose onclick throws, expecting press() to throw.
    const result = Bun.spawnSync(
      ["bun", "test", "./tests/probes/runtime/crash_case.ts"],
      {
        cwd: `${import.meta.dir}/../../..`,
        stderr: "pipe",
        stdout: "pipe",
      },
    );
    const out = result.stdout.toString() + result.stderr.toString();
    // actual: App#on_data catches the error and #crash() calls process.exit(1), so the run
    // stops at the first test and the second test never runs
    expect(out).toContain("2 pass");
    expect(result.exitCode).toBe(0);
  },
);
