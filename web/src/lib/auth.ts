import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";

export interface SessionPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "USER";
  displayName: string | null;
}

export const COOKIE_NAME = "auth_token";
const EXPIRY = "7d";
const BEARER_PREFIX = "Bearer ";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (secret) {
    return new TextEncoder().encode(secret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET es obligatorio en producción");
  }

  return new TextEncoder().encode("dev-secret-please-change-in-production");
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export function getBearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith(BEARER_PREFIX)) return null;
  const token = authorization.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return getBearerToken(req.headers.get("authorization")) ?? req.cookies.get(COOKIE_NAME)?.value ?? null;
}

export async function getSessionToken(): Promise<string | null> {
  const authorization = (await headers()).get("authorization");
  return getBearerToken(authorization) ?? (await cookies()).get(COOKIE_NAME)?.value ?? null;
}

// Server component / Route handler helper
export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return verifyToken(token);
}

// Middleware helper (reads from request directly)
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

export function isAdmin(session: SessionPayload | null): boolean {
  return session?.role === "ADMIN";
}
