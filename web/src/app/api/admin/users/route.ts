import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return null;
}

export async function GET() {
  const deny = await guardAdmin();
  if (deny) return deny;

  const users = await prisma.$queryRawUnsafe<
    { id: string; username: string; role: string; displayName: string | null; createdAt: string }[]
  >(`SELECT id, username, role, displayName, createdAt FROM "User" ORDER BY createdAt ASC`);

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const { username, password, role, displayName } = await req.json() as {
    username: string; password: string; role: string; displayName?: string;
  };

  if (!username || !password) {
    return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 });
  }
  if (!["ADMIN", "USER"].includes(role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "User" WHERE username = ?`, username.trim().toLowerCase()
  );
  if (existing.length) {
    return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 });
  }

  const id = randomBytes(12).toString("hex");
  const hash = await bcrypt.hash(password, 12);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "User" (id, username, passwordHash, role, displayName, createdAt) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    id, username.trim().toLowerCase(), hash, role, displayName ?? null
  );

  return NextResponse.json({ id, username, role }, { status: 201 });
}
