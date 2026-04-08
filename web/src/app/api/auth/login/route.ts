import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, COOKIE_NAME } from "@/lib/auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json() as { username: string; password: string };

  if (!username || !password) {
    return NextResponse.json({ error: "Credenciales requeridas" }, { status: 400 });
  }

  const user = await prisma.$queryRawUnsafe<
    { id: string; username: string; passwordHash: string; role: string; displayName: string | null }[]
  >(`SELECT id, username, passwordHash, role, displayName FROM "User" WHERE username = ?`, username.trim().toLowerCase());

  if (!user.length) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, user[0].passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Usuario o contraseña incorrectos" }, { status: 401 });
  }

  const token = await signToken({
    userId: user[0].id,
    username: user[0].username,
    role: user[0].role as "ADMIN" | "USER",
    displayName: user[0].displayName,
  });

  const res = NextResponse.json({ ok: true, role: user[0].role });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
