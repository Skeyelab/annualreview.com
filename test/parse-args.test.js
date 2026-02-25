import { describe, it, expect } from "vitest";
import { parseArgs } from "../lib/parse-args.js";

describe("parseArgs", () => {
  it("parses string flags", () => {
    const schema = {
      flags: [
        { name: "start", option: "--start", type: "string" },
        { name: "end", option: "--end", type: "string" },
      ],
    };
    const out = parseArgs(schema, ["--start", "2025-01-01", "--end", "2025-12-31"]);
    expect(out.start).toBe("2025-01-01");
    expect(out.end).toBe("2025-12-31");
  });

  it("parses boolean flags", () => {
    const schema = {
      flags: [{ name: "noReviews", option: "--no-reviews", type: "boolean" }],
    };
    expect(parseArgs(schema, []).noReviews).toBe(false);
    expect(parseArgs(schema, ["--no-reviews"]).noReviews).toBe(true);
  });

  it("collects positionals and applies defaults", () => {
    const schema = {
      flags: [{ name: "outDir", option: "--out", type: "string" }],
      positionals: [{ name: "input" }],
      defaults: {
        input: () => "/default/evidence.json",
        outDir: () => "/default/out",
      },
    };
    const out = parseArgs(schema, ["/path/to/ev.json", "--out", "/out"]);
    expect(out.input).toBe("/path/to/ev.json");
    expect(out.outDir).toBe("/out");
  });

  it("applies defaults when positionals and flags missing", () => {
    const schema = {
      flags: [{ name: "outDir", option: "--out", type: "string" }],
      positionals: [{ name: "input" }],
      defaults: {
        input: () => "/default/evidence.json",
        outDir: () => "/default/out",
      },
    };
    const out = parseArgs(schema, []);
    expect(out.input).toBe("/default/evidence.json");
    expect(out.outDir).toBe("/default/out");
  });
});
