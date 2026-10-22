// Encode/decode customer records according to their privacy choices.
// Encrypted fields are bundled into one ciphertext per record; shared fields
// travel as plaintext. Used by the data pages and by the privacy page when a
// choice changes and existing records must be re-saved in the new form.
import { splitByPrefs, type Prefs } from "@/lib/privacy";

type Encrypt = (items: { data: string; tags: string[] }[]) => Promise<string[]>;
type Decrypt = (items: { encrypted: string; tags: string[] }[]) => Promise<string[]>;

const ACCOUNT_TAG = "account";
const USAGE_TAG = "usage";

async function encryptPart(part: Record<string, unknown>, tag: string, doEncrypt: Encrypt): Promise<string | null> {
  if (Object.keys(part).length === 0) return null;
  const [ciphertext] = await doEncrypt([{ data: JSON.stringify(part), tags: [tag] }]);
  return ciphertext;
}

async function decryptPart(ciphertext: string | null, tag: string, doDecrypt: Decrypt): Promise<Record<string, unknown>> {
  if (!ciphertext) return {};
  const [plain] = await doDecrypt([{ encrypted: ciphertext, tags: [tag] }]);
  return JSON.parse(plain);
}

// --- Account profile ---------------------------------------------------------

export interface Profile {
  fullName: string;
  serviceAddress: string;
  phone: string;
  dateOfBirth: string;
}

export const EMPTY_PROFILE: Profile = { fullName: "", serviceAddress: "", phone: "", dateOfBirth: "" };

export interface AccountRecord {
  ciphertext: string | null;
  shared: Record<string, string>;
  updatedAt: string;
}

export async function encodeAccount(profile: Profile, prefs: Prefs, doEncrypt: Encrypt) {
  const { secret, shared } = splitByPrefs(profile, "account", prefs);
  return { ciphertext: await encryptPart(secret, ACCOUNT_TAG, doEncrypt), shared };
}

export async function decodeAccount(record: AccountRecord, doDecrypt: Decrypt): Promise<Profile> {
  return { ...EMPTY_PROFILE, ...(await decryptPart(record.ciphertext, ACCOUNT_TAG, doDecrypt)), ...record.shared };
}

// --- Usage detail ------------------------------------------------------------

export interface UsageDetail {
  devices: { name: string; gb: number }[];
  notes: string;
}

export interface UsageMonth {
  month: string;
  gbUsed: number;
  detailCiphertext: string | null;
  detailShared: Partial<UsageDetail> | null;
}

export async function encodeUsage(detail: UsageDetail, prefs: Prefs, doEncrypt: Encrypt) {
  const { secret, shared } = splitByPrefs(detail, "usage", prefs);
  return {
    detailCiphertext: await encryptPart(secret, USAGE_TAG, doEncrypt),
    detailShared: Object.keys(shared).length ? shared : null,
  };
}

export async function decodeUsage(m: UsageMonth, doDecrypt: Decrypt): Promise<UsageDetail> {
  return { devices: [], notes: "", ...(await decryptPart(m.detailCiphertext, USAGE_TAG, doDecrypt)), ...(m.detailShared ?? {}) };
}

// --- Support ticket notes -------------------------------------------------------

export interface TicketNotes {
  privateCiphertext: string | null;
  privateShared?: string | null;
}

export async function encodeNotes(text: string, prefs: Prefs, doEncrypt: Encrypt): Promise<TicketNotes> {
  if (!text.trim()) return { privateCiphertext: null, privateShared: null };
  if (prefs["support.privateNotes"] === "shared") return { privateCiphertext: null, privateShared: text };
  const [privateCiphertext] = await doEncrypt([{ data: text, tags: [ACCOUNT_TAG] }]);
  return { privateCiphertext, privateShared: null };
}

export async function decodeNotes(t: TicketNotes, doDecrypt: Decrypt): Promise<string> {
  if (t.privateShared) return t.privateShared;
  if (!t.privateCiphertext) return "";
  const [plain] = await doDecrypt([{ encrypted: t.privateCiphertext, tags: [ACCOUNT_TAG] }]);
  return plain;
}
