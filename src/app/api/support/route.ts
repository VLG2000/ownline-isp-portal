import { withAuth } from "@/lib/auth/middleware";
import { isCiphertext } from "@/lib/store";
import { prefsFor } from "@/lib/prefsStore";
import { allTickets, saveTickets, CATEGORIES, type Ticket } from "@/lib/tickets";
import { randomUUID } from "crypto";

// GET /api/support — the caller's own tickets (including their own ciphertext)
export const GET = withAuth(async (_req, jwt) => {
  const tickets = allTickets()
    .filter((t) => t.ownerId === jwt.sub)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Response.json({ tickets });
});

// POST /api/support — open a ticket.
// Body: { subject, category, sharedSummary, privateCiphertext?, privateShared? }
export const POST = withAuth(async (req, jwt) => {
  const { subject, category, sharedSummary, privateCiphertext, privateShared } = await req.json();
  if (typeof subject !== "string" || !subject.trim() || subject.length > 120) {
    return Response.json({ error: "Invalid subject" }, { status: 400 });
  }
  if (!CATEGORIES.includes(category)) {
    return Response.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof sharedSummary !== "string" || sharedSummary.length > 2000) {
    return Response.json({ error: "Invalid sharedSummary" }, { status: 400 });
  }
  const notesError = checkNotes(jwt.sub!, privateCiphertext, privateShared);
  if (notesError) return Response.json({ error: notesError }, { status: 400 });
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: randomUUID(),
    ownerId: jwt.sub!,
    subject: subject.trim(),
    category,
    sharedSummary: sharedSummary.trim(),
    privateCiphertext: privateCiphertext ?? null,
    privateShared: privateShared ?? null,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
  saveTickets([...allTickets(), ticket]);
  return Response.json({ ticket }, { status: 201 });
});

// PATCH /api/support — re-save a ticket's extra notes after a privacy change.
// Body: { id, privateCiphertext?, privateShared? }. Owner only.
export const PATCH = withAuth(async (req, jwt) => {
  const { id, privateCiphertext, privateShared } = await req.json();
  const notesError = checkNotes(jwt.sub!, privateCiphertext, privateShared);
  if (notesError) return Response.json({ error: notesError }, { status: 400 });
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === id && t.ownerId === jwt.sub);
  if (!ticket) return Response.json({ error: "Ticket not found" }, { status: 404 });
  ticket.privateCiphertext = privateCiphertext ?? null;
  ticket.privateShared = privateShared ?? null;
  ticket.updatedAt = new Date().toISOString();
  saveTickets(tickets);
  return Response.json({ ticket });
});

// Plaintext notes are accepted only if the customer chose to share them.
function checkNotes(userId: string, privateCiphertext: unknown, privateShared: unknown): string | null {
  if (privateCiphertext != null && !isCiphertext(privateCiphertext)) return "privateCiphertext must be Tide ciphertext";
  if (privateShared != null) {
    if (typeof privateShared !== "string" || privateShared.length > 2000) return "Invalid privateShared";
    if (prefsFor(userId)["support.privateNotes"] !== "shared") return "Plaintext sent for notes you chose to encrypt";
  }
  return null;
}
