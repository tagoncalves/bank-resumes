import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit({
    key: `verify-email:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Demasiados intentos de validación. Probá nuevamente en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { username, code } = await req.json() as { username?: string; code?: string };
  const normalizedUsername = username?.trim().toLowerCase() ?? "";
  const normalizedCode = code?.trim() ?? "";

  if (!normalizedUsername || !normalizedCode) {
    return NextResponse.json({ error: "Usuario y clave son requeridos" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: {
      id: true,
      emailVerifiedAt: true,
      emailVerificationCodeHash: true,
      emailVerificationExpiresAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, message: "El email ya estaba validado" });
  }

  if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
    return NextResponse.json({ error: "No hay una clave de validación activa" }, { status: 400 });
  }

  if (user.emailVerificationExpiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "La clave venció. Registrate nuevamente para generar otra clave." }, { status: 400 });
  }

  const valid = await bcrypt.compare(normalizedCode, user.emailVerificationCodeHash);
  if (!valid) {
    return NextResponse.json({ error: "Clave inválida" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    },
  });

  return NextResponse.json({ ok: true, message: "Email validado. Ya podés iniciar sesión." });
}
