import { readJson, writeJson } from "@/lib/store";

// Support tickets. The customer decides what the support team may read:
// `sharedSummary` is written by the customer for support to see, in plaintext,
// by explicit choice. Extra notes follow the "support.privateNotes" privacy
// choice: `privateCiphertext` (tag `account`, readable only by the customer)
// or `privateShared` (plaintext, sent to support). Per-case encrypted sharing
// with an assigned agent is the planned RelationshipAttestation:1 upgrade.
export interface Ticket {
  id: string;
  ownerId: string;
  subject: string;
  category: "outage" | "billing" | "speed" | "other";
  sharedSummary: string;
  privateCiphertext: string | null;
  privateShared?: string | null;
  status: "open" | "in-progress" | "resolved";
  createdAt: string;
  updatedAt: string;
}

export const CATEGORIES = ["outage", "billing", "speed", "other"] as const;
export const STATUSES = ["open", "in-progress", "resolved"] as const;

export function allTickets(): Ticket[] {
  return readJson<Ticket[]>("tickets", "all", []);
}

export function saveTickets(tickets: Ticket[]): void {
  writeJson("tickets", "all", tickets);
}

// What a support agent receives: never the ciphertext, and no owner id —
// only a per-ticket reference. Notes the customer shared are included.
export function forSupport(t: Ticket) {
  const { privateCiphertext, ownerId, ...rest } = t;
  return { ...rest, privateShared: t.privateShared ?? null, hasPrivateDetails: privateCiphertext !== null };
}
