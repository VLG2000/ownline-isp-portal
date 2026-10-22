import { unlinkSync } from "fs";
import { join } from "path";
import { listKeys } from "@/lib/store";
import { allTickets, saveTickets } from "@/lib/tickets";

// DEMO MODE ONLY: wipe every demo persona's stored records so the demo starts
// fresh (e.g. after the browser's demo keys were cleared and old ciphertext can
// no longer be decrypted). Real users' records are never touched, and the route
// refuses to run unless the dev-only demo bypass is on.
const DEMO_BYPASS = process.env.DEMO_MODE === "1" && process.env.NODE_ENV === "development";
const DATA_DIR = join(process.cwd(), "data", "store");

export async function POST() {
  if (!DEMO_BYPASS) return Response.json({ error: "Not available" }, { status: 404 });
  let removed = 0;
  for (const collection of ["account", "usage", "privacy", "service"]) {
    for (const key of listKeys(collection).filter((k) => k.startsWith("demo-"))) {
      unlinkSync(join(DATA_DIR, `${collection}__${key}.json`));
      removed++;
    }
  }
  const tickets = allTickets();
  const kept = tickets.filter((t) => !t.ownerId.startsWith("demo-"));
  saveTickets(kept);
  return Response.json({ removed: removed + (tickets.length - kept.length) });
}
