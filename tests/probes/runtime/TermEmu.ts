// Minimal emulator for inline-mode output: handles CR, LF, CSI F/A/B/C/D/G/H/J/K.
export class TermEmu {
  lines: string[][] = [[]];
  x = 0;
  y = 0;
  constructor(public width: number) {}
  write(data: string) {
    let i = 0;
    while (i < data.length) {
      const ch = data[i];
      if (ch === "\x1b" && data[i + 1] === "[") {
        let j = i + 2;
        while (j < data.length && !/[@-~]/.test(data[j])) j++;
        const params = data.slice(i + 2, j);
        const final = data[j];
        const n = Number(params.replace("?", "") || 1);
        if (final === "F") {
          this.y = Math.max(0, this.y - n);
          this.x = 0;
        } else if (final === "A") this.y = Math.max(0, this.y - n);
        else if (final === "K") {
          this.row().length = Math.min(this.row().length, this.x);
        } else if (final === "J") {
          this.row().length = Math.min(this.row().length, this.x);
          this.lines.length = this.y + 1;
        } else if (final === "G") this.x = n - 1;
        i = j + 1;
        continue;
      }
      if (ch === "\r") {
        this.x = 0;
        i++;
        continue;
      }
      if (ch === "\n") {
        this.y++;
        this.x = 0;
        while (this.lines.length <= this.y) this.lines.push([]);
        i++;
        continue;
      }
      if (ch === "\x1b") {
        i += 2;
        continue;
      }
      const r = this.row();
      while (r.length < this.x) r.push(" ");
      r[this.x++] = ch;
      i++;
    }
  }
  row() {
    while (this.lines.length <= this.y) this.lines.push([]);
    return this.lines[this.y];
  }
  toString() {
    return this.lines
      .map((l) => l.join("").trimEnd())
      .join("\n")
      .replace(/\n+$/, "");
  }
}
