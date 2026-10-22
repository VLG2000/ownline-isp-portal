import { NextRequest } from "next/server";
import { verifyTideJWT, hasRole, extractToken } from "./tideJWT";
import { verifyDpop } from "./verifyDpop";
import type { JWTPayload } from "jose";
import { PERSONAS, PERSONA_HEADER, type PersonaId } from "@/lib/demo";

type AuthHandler = (req: NextRequest, jwt: JWTPayload) => Promise<Response>;

// DEMO MODE bypass (see src/lib/demo.ts): only with DEMO_MODE=1 under `next dev`.
// A production build ignores it, whatever the environment says.
const DEMO_BYPASS = process.env.DEMO_MODE === "1" && process.env.NODE_ENV === "development";
function demoJwt(req: NextRequest): JWTPayload {
  const id = req.headers.get(PERSONA_HEADER) as PersonaId | null;
  const persona = PERSONAS[id && id in PERSONAS ? id : "customer"];
  return { sub: persona.sub, realm_access: { roles: [...persona.roles] } };
}

export function withAuth(handler: AuthHandler) {
  return async (req: NextRequest) => {
    if (DEMO_BYPASS) return handler(req, demoJwt(req));
    try {
      const token = extractToken(req.headers.get("authorization"));
      const jwt = await verifyTideJWT(token);
      // The signature alone is not enough. This realm issues sender-constrained tokens (cnf.jkt),
      // and without checking the DPoP proof a stolen token replays as a plain `Bearer` and passes
      // (AP-43). verifyDpop rejects an unbound token, a Bearer-scheme replay, a proof signed by a
      // different key, and a proof for another URL or method. It throws; the catch below answers 401.
      await verifyDpop(req, token, jwt as { cnf?: { jkt?: string } });
      return handler(req, jwt);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Unauthorized" },
        { status: 401 }
      );
    }
  };
}

export function withRole(role: string, handler: AuthHandler) {
  return withAuth(async (req, jwt) => {
    if (!hasRole(jwt, role)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, jwt);
  });
}
