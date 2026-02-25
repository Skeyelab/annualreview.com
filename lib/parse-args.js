/**
 * Schema-driven CLI argument parser. Use from scripts to avoid duplicated parseArgs logic.
 *
 * @param {{ flags: Array<{ name: string, option: string, type: 'string' | 'boolean' }>, positionals?: Array<{ name: string }>, defaults?: Record<string, unknown | (() => unknown)> }} schema
 * @param {string[]} [argv=process.argv.slice(2)]
 * @returns {Record<string, unknown>}
 */
export function parseArgs(schema, argv = process.argv.slice(2)) {
  const result = {};
  const positionals = [];

  for (const f of schema.flags ?? []) {
    result[f.name] = f.type === "boolean" ? false : null;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const flag = schema.flags?.find((f) => f.option === arg);
    if (flag) {
      if (flag.type === "boolean") {
        result[flag.name] = true;
      } else if (argv[i + 1] != null) {
        result[flag.name] = argv[++i];
      }
      continue;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
    }
  }

  for (let j = 0; j < (schema.positionals ?? []).length; j++) {
    const p = schema.positionals[j];
    result[p.name] = positionals[j] ?? null;
  }

  for (const [key, val] of Object.entries(schema.defaults ?? {})) {
    if (result[key] == null) {
      result[key] = typeof val === "function" ? val() : val;
    }
  }

  return result;
}
