import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const CODE_TTL_MINUTES = 30;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateCode() {
  return String(randomInt(100000, 1000000));
}

function buildMailto(email: string, code: string) {
  const subject = "Clave de validacion de Nerum Finance";
  const body = [
    "Usa esta clave para validar tu cuenta en Nerum Finance:",
    "",
    code,
    "",
    `La clave vence en ${CODE_TTL_MINUTES} minutos.`,
  ].join("\n");

  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimit = enforceRateLimit({
    key: `register:${ip}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Demasiados registros recientes. Probá nuevamente en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const { username, email, password } = await req.json() as {
    username?: string;
    email?: string;
    password?: string;
  };

  const normalizedUsername = normalizeUsername(username ?? "");
  const normalizedEmail = normalizeEmail(email ?? "");

  if (!normalizedUsername || !normalizedEmail || !password) {
    return NextResponse.json({ error: "Usuario, email y contraseña son requeridos" }, { status: 400 });
  }

  if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUsername)) {
    return NextResponse.json({ error: "El usuario debe tener 3 a 32 caracteres: letras, números, punto, guion o guion bajo" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: normalizedUsername },
        { email: normalizedEmail },
      ],
    },
    select: { id: true, username: true, email: true, emailVerifiedAt: true },
  });

  if (existing?.emailVerifiedAt) {
    const field = existing.username === normalizedUsername ? "usuario" : "email";
    return NextResponse.json({ error: `El ${field} ya está registrado` }, { status: 409 });
  }

  if (existing && existing.username !== normalizedUsername) {
    return NextResponse.json({ error: "El email ya está asociado a otro usuario pendiente" }, { status: 409 });
  }

  if (existing && existing.email !== normalizedEmail) {
    return NextResponse.json({ error: "El usuario ya está asociado a otro email pendiente" }, { status: 409 });
  }

  const code = generateCode();
  const [passwordHash, codeHash] = await Promise.all([
    bcrypt.hash(password, 12),
    bcrypt.hash(code, 12),
  ]);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          emailVerificationCodeHash: codeHash,
          emailVerificationExpiresAt: expiresAt,
        },
        select: { username: true, email: true },
      })
    : await prisma.user.create({
        data: {
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
          role: "USER",
          emailVerificationCodeHash: codeHash,
          emailVerificationExpiresAt: expiresAt,
        },
        select: { username: true, email: true },
      });

  return NextResponse.json({
    ok: true,
    username: user.username,
    email: user.email,
    mailtoUrl: buildMailto(normalizedEmail, code),
    message: "Abrí el correo generado y usá la clave para validar la cuenta.",
  }, { status: existing ? 200 : 201 });
}
