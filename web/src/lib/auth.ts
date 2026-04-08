import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

export interface SessionPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "USER";
  displayName: string | null;
}

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-please-change-in-production"
);
export const COOKIE_NAME = "auth_token";
const EXPIRY = "7d";

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

// Server component / Route handler helper
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Middleware helper (reads from request directly)
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function isAdmin(session: SessionPayload | null): boolean {
  return session?.role === "ADMIN";
}
