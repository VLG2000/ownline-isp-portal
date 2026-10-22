// Per-field privacy choices. Shared by the client (what to encrypt) and the
// server (what plaintext it will accept). Every customer-controllable field
// defaults to "encrypted"; locked fields are ones the ISP needs to operate.

export type Visibility = "encrypted" | "shared";

export interface FieldDef {
  key: string;
  label: string;
  section: "Account" | "Usage" | "Support" | "Service";
  why: string; // shown when encrypted (or the reason it is locked)
  whyShared?: string; // shown when the customer shares it
  locked?: true; // always visible to the ISP; not customer-controllable
}

export const FIELDS: FieldDef[] = [
  { key: "account.fullName", label: "Full name", section: "Account", why: "Encrypted in your browser (tag: account).", whyShared: "Lets support greet you by name." },
  { key: "account.serviceAddress", label: "Service address", section: "Account", why: "Encrypted in your browser (tag: account).", whyShared: "Lets technicians find the premises without asking you." },
  { key: "account.phone", label: "Phone", section: "Account", why: "Encrypted in your browser (tag: account).", whyShared: "Lets the ISP call you about outages." },
  { key: "account.dateOfBirth", label: "Date of birth", section: "Account", why: "Encrypted in your browser (tag: account).", whyShared: "Readable by the ISP — usually only needed for identity checks." },
  { key: "usage.devices", label: "Per-device usage breakdown", section: "Usage", why: "Encrypted (tag: usage). Stops household profiling.", whyShared: "Helps support diagnose which device is slow — but reveals your household's devices." },
  { key: "usage.notes", label: "Usage notes", section: "Usage", why: "Encrypted (tag: usage).", whyShared: "Readable by the ISP." },
  { key: "support.privateNotes", label: "Extra notes on support tickets", section: "Support", why: "Only you can decrypt them; never sent to support staff.", whyShared: "Sent to the support team alongside the ticket summary." },
  { key: "support.summary", label: "Support ticket summary", section: "Support", why: "You write it for the support team and decide what goes in it.", locked: true },
  { key: "service.plan", label: "Plan, price, connection ID, status, next bill date", section: "Service", why: "Needed to deliver and bill the service.", locked: true },
  { key: "usage.total", label: "Monthly data total (GB)", section: "Usage", why: "Needed for billing.", locked: true },
  { key: "login.times", label: "When you log in", section: "Service", why: "The login server sees sign-in times. It never sees your password.", locked: true },
];

export const CONTROLLABLE = FIELDS.filter((f) => !f.locked).map((f) => f.key);

export type Prefs = Record<string, Visibility>;

export const DEFAULT_PREFS: Prefs = Object.fromEntries(CONTROLLABLE.map((k) => [k, "encrypted" as Visibility]));

export function normalizePrefs(raw: unknown): Prefs {
  const out: Prefs = { ...DEFAULT_PREFS };
  if (raw && typeof raw === "object") {
    for (const k of CONTROLLABLE) {
      const v = (raw as Record<string, unknown>)[k];
      if (v === "encrypted" || v === "shared") out[k] = v;
    }
  }
  return out;
}

// Split a record into the part to encrypt and the part to store in plaintext.
// `prefix` is the FIELDS key prefix, e.g. "account" for "account.fullName".
export function splitByPrefs(record: object, prefix: string, prefs: Prefs) {
  const secret: Record<string, unknown> = {};
  const shared: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (prefs[`${prefix}.${k}`] === "shared") shared[k] = v;
    else secret[k] = v;
  }
  return { secret, shared };
}

// Server-side check: every plaintext key must be one the customer chose to share.
export function sharedKeysAllowed(shared: unknown, prefix: string, prefs: Prefs): boolean {
  if (shared == null) return true;
  if (typeof shared !== "object" || Array.isArray(shared)) return false;
  return Object.keys(shared).every((k) => prefs[`${prefix}.${k}`] === "shared");
}
