import { withRole } from "@/lib/auth/middleware";
import { readJson, listKeys } from "@/lib/store";
import { allTickets } from "@/lib/tickets";
import { prefsFor } from "@/lib/prefsStore";

// ISP admin view (realm role `isp-admin`, checked on the server): every
// customer's records exactly as the ISP's database holds them. Encrypted
// fields come back as ciphertext because that is all the ISP has — there is
// no server-side key that could turn them into plaintext.

// GET /api/admin/customers
export const GET = withRole("isp-admin", async () => {
  const ids = new Set([...listKeys("account"), ...listKeys("usage"), ...listKeys("privacy"), ...listKeys("service")]);
  const tickets = allTickets();
  const customers = [...ids].sort().map((id) => {
    const account = readJson<{ ciphertext: string | null; shared?: Record<string, string>; updatedAt: string } | null>("account", id, null);
    const usage = readJson<{ month: string; gbUsed: number; detailCiphertext: string | null; detailShared?: unknown }[]>("usage", id, []);
    const service = readJson<{ planId: string; connectionId: string; status: string } | null>("service", id, null);
    const own = tickets.filter((t) => t.ownerId === id);
    return {
      id,
      prefs: prefsFor(id),
      service,
      account: account && { ciphertext: account.ciphertext, shared: account.shared ?? {}, updatedAt: account.updatedAt },
      usage: usage
        .sort((a, b) => b.month.localeCompare(a.month))
        .map((m) => ({ month: m.month, gbUsed: m.gbUsed, detailCiphertext: m.detailCiphertext, detailShared: m.detailShared ?? null })),
      tickets: own.map((t) => ({ id: t.id, subject: t.subject, status: t.status, privateCiphertext: t.privateCiphertext, privateShared: t.privateShared ?? null })),
    };
  });
  return Response.json({ customers });
});
