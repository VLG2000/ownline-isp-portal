// DEMO MODE — skips Tide login for local demos. Enabled only when
// NEXT_PUBLIC_DEMO_MODE=1 (client) / DEMO_MODE=1 (server) AND running `next dev`.
// Encryption still happens in the browser, but with an AES-GCM key kept in this
// browser's localStorage instead of the Tide network: it shows the data flow,
// not Tide's guarantee (no single party holding the key). Never ship it on.
//
// Three personas can be switched live from the demo banner. Each has its own
// key, so — as with real Tide self-encryption — one persona cannot decrypt
// another's data.

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1" && process.env.NODE_ENV === "development";

export const PERSONAS = {
  customer: { label: "Customer", sub: "demo-customer", roles: ["appUser"] },
  agent: { label: "Support agent", sub: "demo-agent", roles: ["appUser", "support-agent"] },
  admin: { label: "ISP admin", sub: "demo-admin", roles: ["appUser", "isp-admin"] },
} as const;
export type PersonaId = keyof typeof PERSONAS;

export const PERSONA_HEADER = "x-demo-persona";

const PERSONA_STORAGE = "isp-portal-demo-persona";

export function getPersona(): PersonaId {
  try {
    const p = localStorage.getItem(PERSONA_STORAGE);
    if (p && p in PERSONAS) return p as PersonaId;
  } catch {}
  return "customer";
}

export function setPersona(p: PersonaId): void {
  try {
    localStorage.setItem(PERSONA_STORAGE, p);
  } catch {}
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function demoKey(): Promise<CryptoKey> {
  const storageKey = `isp-portal-demo-key-${getPersona()}`;
  let raw = localStorage.getItem(storageKey);
  if (!raw) {
    raw = toB64(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(storageKey, raw);
  }
  return crypto.subtle.importKey("raw", fromB64(raw) as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Same call shapes as the Tide SDK's doEncrypt/doDecrypt. The tag is bound as
// additional authenticated data, so decrypting with the wrong tag fails, as with Tide.
export async function demoEncrypt(items: { data: string; tags: string[] }[]): Promise<string[]> {
  const key = await demoKey();
  return Promise.all(
    items.map(async ({ data, tags }) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(tags.join(",")) },
          key,
          new TextEncoder().encode(data)
        )
      );
      const out = new Uint8Array(iv.length + ct.length);
      out.set(iv);
      out.set(ct, iv.length);
      return toB64(out);
    })
  );
}

export async function demoDecrypt(items: { encrypted: string; tags: string[] }[]): Promise<string[]> {
  const key = await demoKey();
  return Promise.all(
    items.map(async ({ encrypted, tags }) => {
      const bytes = fromB64(encrypted);
      try {
        const pt = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(tags.join(",")) },
          key,
          bytes.slice(12)
        );
        return new TextDecoder().decode(pt);
      } catch {
        throw new Error("Access denied: this data is encrypted with someone else's key");
      }
    })
  );
}
