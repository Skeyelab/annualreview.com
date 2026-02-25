/**
 * Validate a JSON file against schemas/evidence.json.
 * Usage: node scripts/validate-evidence.js [path/to/evidence.json]
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

let Ajv;
try {
  Ajv = (await import("ajv")).default;
} catch {
  console.error("Run: yarn add ajv");
  process.exit(1);
}

const schemaPath = join(__dirname, "..", "schemas", "evidence.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const ajv = new Ajv({ strict: false });
const validate = ajv.compile(schema);

const evidencePath = process.argv[2] || join(process.cwd(), "evidence.json");
const data = JSON.parse(readFileSync(evidencePath, "utf8"));

if (validate(data)) {
  console.log("Valid:", evidencePath);
} else {
  console.error("Invalid:", evidencePath);
  console.error(validate.errors);
  process.exit(1);
}
