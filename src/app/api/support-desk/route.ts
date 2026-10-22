import { withRole } from "@/lib/auth/middleware";
import { allTickets, saveTickets, forSupport, STATUSES } from "@/lib/tickets";

// Support staff only (realm role `support-agent`, checked on the server).
// Agents see what customers chose to share, never the encrypted private details.

// GET /api/support-desk — every ticket, support view
export const GET = withRole("support-agent", async () => {
  const tickets = allTickets()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(forSupport);
  return Response.json({ tickets });
});

// PATCH /api/support-desk — update a ticket's status. Body: { id, status }
export const PATCH = withRole("support-agent", async (req) => {
  const { id, status } = await req.json();
  if (!STATUSES.includes(status)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  const tickets = allTickets();
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) {
    return Response.json({ error: "Ticket not found" }, { status: 404 });
  }
  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  saveTickets(tickets);
  return Response.json({ ticket: forSupport(ticket) });
});
