import { NextResponse } from "next/server";
import { getSession, isAdmin, type SessionPayload } from "@/lib/auth";

export async function requireAdmin(): Promise<
  { session: SessionPayload; deny: null } | { session: null; deny: NextResponse }
> {
  const session = await getSession();

  if (!session || !isAdmin(session)) {
    return {
      session: null,
      deny: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { session, deny: null };
}
