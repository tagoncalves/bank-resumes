import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return session;
}

export async function GET() {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const bans = await prisma.aiBan.findMany({
    orderBy: [{ status: "asc" }, { bannedAt: "desc" }],
    include: {
      user: { select: { id: true, username: true, displayName: true, aiBlockLevel: true, aiBlockedUntil: true, aiMisuseCount: true } },
      pardonedBy: { select: { id: true, username: true } },
    },
  });

  // Find orphaned bans (users with active block state but no AiBan record)
  const bannedUserIds = new Set(bans.map((b) => b.userId));
  const orphaned = await prisma.user.findMany({
    where: {
      OR: [
        { aiBlockLevel: { gt: 0 } },
        { aiBlockedUntil: { not: null } },
      ],
      id: { notIn: [...bannedUserIds] },
    },
    select: {
      id: true, username: true, displayName: true,
      aiBlockLevel: true, aiBlockedUntil: true, aiMisuseCount: true,
    },
  });

  const orphanedBans = orphaned.map((u) => ({
    id: `orphan-${u.id}`,
    userId: u.id,
    level: Math.max(u.aiBlockLevel, 1),
    status: "ACTIVE" as const,
    reason: "Bloqueo heredado del modelo anterior (sin registro AiBan)",
    bannedAt: "2000-01-01T00:00:00.000Z",
    expiresAt: u.aiBlockedUntil?.toISOString() ?? null,
    pardonedAt: null,
    pardonedById: null,
    user: { id: u.id, username: u.username, displayName: u.displayName, aiBlockLevel: u.aiBlockLevel, aiBlockedUntil: u.aiBlockedUntil, aiMisuseCount: u.aiMisuseCount },
    pardonedBy: null,
  }));

  return NextResponse.json([...orphanedBans, ...bans]);
}

export async function PATCH(request: Request) {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const { banId, userId } = await request.json();
  if (!banId && !userId) return NextResponse.json({ error: "banId o userId requerido" }, { status: 400 });

  // Orphaned ban: create AiBan record then pardon
  if (banId?.startsWith("orphan-") && userId) {
    await prisma.$transaction([
      prisma.aiBan.create({
        data: {
          userId,
          level: 1,
          status: "PARDONED",
          reason: "Perdonado por admin (bloqueo heredado)",
          pardonedAt: new Date(),
          pardonedById: session.userId,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { aiMisuseCount: 0, aiBlockedUntil: null, aiBlockLevel: 0 },
      }),
    ]);
    return NextResponse.json({ success: true });
  }

  const ban = await prisma.aiBan.findUnique({ where: { id: banId } });
  if (!ban) return NextResponse.json({ error: "Ban no encontrado" }, { status: 404 });

  await prisma.$transaction([
    prisma.aiBan.update({
      where: { id: banId },
      data: { status: "PARDONED", pardonedAt: new Date(), pardonedById: session.userId },
    }),
    prisma.user.update({
      where: { id: ban.userId },
      data: { aiMisuseCount: 0, aiBlockedUntil: null, aiBlockLevel: 0 },
    }),
  ]);

  return NextResponse.json({ success: true });
}
