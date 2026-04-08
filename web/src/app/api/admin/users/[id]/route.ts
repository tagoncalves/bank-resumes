import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const { role, displayName, password } = await req.json() as {
    role?: string; displayName?: string; password?: string;
  };

  const session = await getSession();
  // Prevent self-demotion
  if (role && role !== "ADMIN" && session?.userId === params.id) {
    return NextResponse.json({ error: "No podés cambiar tu propio rol" }, { status: 400 });
  }

  if (role) {
    await prisma.$executeRawUnsafe(`UPDATE "User" SET role = ? WHERE id = ?`, role, params.id);
  }
  if (displayName !== undefined) {
    await prisma.$executeRawUnsafe(`UPDATE "User" SET displayName = ? WHERE id = ?`, displayName, params.id);
  }
  if (password) {
    const hash = await bcrypt.hash(password, 12);
    await prisma.$executeRawUnsafe(`UPDATE "User" SET passwordHash = ? WHERE id = ?`, hash, params.id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const deny = await guardAdmin();
  if (deny) return deny;

  const session = await getSession();
  if (session?.userId === params.id) {
    return NextResponse.json({ error: "No podés eliminar tu propia cuenta" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = ?`, params.id);
  return NextResponse.json({ ok: true });
}
