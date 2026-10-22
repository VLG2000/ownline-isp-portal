import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

// Filesystem JSON store. Survives Next.js dev hot reload (in-memory stores reset
// on every file change in dev mode). For production, replace with a real database.
// Every value written here is either ciphertext or data the ISP must see to
// operate (plan, billing totals, ticket status). Plaintext PII never arrives.
const DATA_DIR = join(process.cwd(), "data", "store");
mkdirSync(DATA_DIR, { recursive: true });

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function readJson<T>(collection: string, key: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, `${safeName(collection)}__${safeName(key)}.json`), "utf-8"));
  } catch {
    return fallback;
  }
}

export function writeJson<T>(collection: string, key: string, value: T): void {
  writeFileSync(join(DATA_DIR, `${safeName(collection)}__${safeName(key)}.json`), JSON.stringify(value, null, 2));
}

// Every key stored in a collection (e.g. every customer id with an account record).
export function listKeys(collection: string): string[] {
  const prefix = `${safeName(collection)}__`;
  return readdirSync(DATA_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => f.slice(prefix.length, -".json".length));
}

// Ciphertext from the Tide SDK is a base64 string. Reject anything that is not,
// so a buggy client cannot quietly store plaintext in an "encrypted" field.
export function isCiphertext(value: unknown): value is string {
  return typeof value === "string" && value.length >= 40 && value.length < 2_000_000 && /^[A-Za-z0-9+/=_-]+$/.test(value);
}
