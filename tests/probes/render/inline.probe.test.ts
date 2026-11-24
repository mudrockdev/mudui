import { describe, expect, test } from "bun:test";
import { flushSync } from "svelte";
import { renderTest } from "../../../src/lib/testing/index.ts";
import { graphemes, graphemeWidth } from "../../../src/lib/renderer/text.ts";
import Lines from "./Lines.svelte";
import { store } from "./store.svelte.ts";

/**
 * Inline-mode terminal model: \r, \n, CSI F/K/J, and DEC/xterm auto-wrap where
 * writing the last column leaves the cursor ON that column with a pending wrap
 * (so a following EL erases from the last column).
 */
class Tty {
  grid: string[][];
  x = 0;
  y = 0;
  pending = false;
  constructor(public w: number, public h: number) {
    this.grid = Array.from({ length: h }, () => Array(w).fill(" "));
  }
  lf() {
    if (this.y === this.h - 1) {
      this.grid.shift();
      this.grid.push(Array(this.w).fill(" "));
    } else this.y++;
  }
  write(d: string) {
    let i = 0;
    while (i < d.length) {
      const ch = d[i];
      if (ch === "\x1b" && d[i + 1] === "[") {
        let j = i + 2;
        while (!/[@-~]/.test(d[j])) j++;
        const p = d.slice(i + 2, j);
        const f = d[j];
        const n = Number(p || 1);
        if (f === "F") {
          this.y = Math.max(0, this.y - n);
          this.x = 0;
          this.pending = false;
        } else if (f === "K") {
          for (let x = this.x; x < this.w; x++) this.grid[this.y][x] = " ";
          this.pending = false;
        } else if (f === "J" && (p === "" || p === "0")) {
          for (let x = this.x; x < this.w; x++) this.grid[this.y][x] = " ";
          for (let y = this.y + 1; y < this.h; y++) this.grid[y].fill(" ");
        }
        i = j + 1;
        continue;
      }
      if (ch === "\r") { this.x = 0; this.pending = false; i++; continue; }
      if (ch === "\n") { this.lf(); this.x = 0; this.pending = false; i++; continue; }
      let j = i;
      while (j < d.length && !/[\x1b\r\n]/.test(d[j])) j++;
      for (const g of graphemes(d.slice(i, j))) {
        const gw = graphemeWidth(g);
        if (this.pending) { this.lf(); this.x = 0; this.pending = false; }
        this.grid[this.y][this.x] = g;
        if (gw === 2) this.grid[this.y][this.x + 1] = "";
        this.x += gw;
        if (this.x >= this.w) { this.x = this.w - 1; this.pending = true; }
      }
      i = j;
    }
  }
  text() {
    const l = this.grid.map((r) => r.join("").trimEnd());
    while (l.length && !l[l.length - 1]) l.pop();
    return l.join("\n");
  }
}

describe("probe: inline mode output", () => {
  test.failing("content reaching the last column survives the erase-line after it", () => {
    store.lines = ["first"];
    const t = renderTest(Lines, { width: 10, height: 8, fullscreen: false });
    const tty = new Tty(10, 8);
    let seen = 0;
    const check = () => {
      const f = t.frame();
      tty.write(t.terminal.output.slice(seen));
      seen = t.terminal.output.length;
      expect(tty.text()).toBe(f);
    };
    check();
    store.lines = ["1234567890", "abc"];
    flushSync();
    check(); // last column "0" is erased by \x1b[K written right after it
    t.unmount();
  });
});
