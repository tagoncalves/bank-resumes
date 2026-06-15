import { prisma } from "@/lib/prisma";

const MISUSE_LIMIT = 3;

function midnightNextDay(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
}

// ─── Classification ────────────────────────────────────────────────────────────

const CONVERSATIONAL_FILLERS = new Set([
  "hola", "buenas", "buen día", "buen dia", "buenas tardes", "buenas noches",
  "chau", "adiós", "adios", "hasta luego", "nos vemos", "hasta pronto",
  "gracias", "muchas gracias", "gracias totales",
  "ok", "okey", "okay", "bueno", "dale", "listo", "perfecto", "genial", "excelente",
  "sí", "si", "no", "claro", "entiendo", "ya veo",
  "bien", "muy bien", "todo bien", "todo ok",
  "qué más", "que mas", "qué mas", "que más",
  "y vos", "y tu", "bien y vos", "bien y tu", "bien y usted",
  "interesante", "qué interesante", "que interesante",
]);

function isConversationalFiller(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[.!?]+$/, "");
  if (CONVERSATIONAL_FILLERS.has(t)) return true;
  const sentences = t.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length <= 2 && sentences.every((s) => CONVERSATIONAL_FILLERS.has(s))) return true;
  return false;
}

function isFinancialQuery(text: string): boolean {
  const lower = text.toLowerCase();

  const metaQuestions = [
    "qué podes hacer", "que podes hacer", "qué puedes hacer", "que puedes hacer",
    "cómo funcionas", "como funcionas", "para qué sirves", "para que sirves",
    "quién eres", "quien eres", "quién sos", "quien sos",
    "que más sabes hacer", "qué más sabes hacer",
  ];
  if (metaQuestions.some((m) => lower.includes(m))) return true;

  const financialKeywords = [
    "peso", "dólar", "dolar", "dolares", "dólares", "euro", "euros", "real", "brl", "clp", "uyu",
    "blue", "mep", "ccl", "contado con liqui", "contadoconliqui",
    "tarjeta", "resumen", "recibo", "sueldo", "salario", "salarial",
    "ingreso", "egreso", "gasto", "gastos", "ingresos",
    "banco", "bancaria", "bancario", "transferencia", "debin", "coelsa",
    "qr", "pago", "pagar", "pagó", "cuota", "cuotas",
    "prestamo", "préstamo", "prestamos", "préstamos",
    "interes", "interés", "intereses", "tna", "tem", "tea", "cft",
    "impuesto", "impuestos", "iva", "iibb", "ingresos brutos",
    "comision", "comisión", "comisiones",
    "inversion", "inversión", "inversiones", "invertir",
    "ahorro", "ahorrar", "plazo fijo", "plazos fijos",
    "cuenta", "cuentas", "caja de ahorro", "cuenta corriente",
    "movimiento", "movimientos", "transaccion", "transacción", "transacciones",
    "comercio", "compras", "compra", "gastaste", "gasté",
    "categoria", "categoría", "categorias", "categorías",
    "balance", "balances", "saldo", "saldos",
    "vencimiento", "vencimientos", "consumo", "consumos",
    "financi", "financiera", "financiero",
    "cripto", "stablecoin", "usdt", "usdc", "criptomoneda",
    "moneda", "cotizacion", "cotización", "cotizaciones",
    "presupuesto", "presupuestar",
    "economia", "economía", "económico", "economico",
    "bienes personales", "ganancias", "monotributo",
    "factura", "facturas", "facturar",
    "neto", "bruto", "empleador", "empleado",
    "período", "periodo", "haber", "haberes",
    "deduccion", "deducción", "deducciones",
    "inflacion", "inflación", "ipc", "índice de precios",
    "cuánto gasté", "cuanto gaste", "cuánto gané", "cuanto gane",
    "en qué gasto", "donde gasto", "dónde gasto",
    "mis gastos", "mis ingresos", "mi sueldo",
    "cuánto tengo", "cuanto tengo", "cuánto debo", "cuanto debo",
  ];

  return financialKeywords.some((kw) => lower.includes(kw));
}

// ─── Public types ──────────────────────────────────────────────────────────────

export type MisuseResult = {
  allowed: boolean;
  blocked: boolean;
  count: number;
  remaining: number;
  blockLevel: number;
  blockedUntil: number | null;
  permanent: boolean;
  message: string;
};

type BanDurations = {
  durationMs: number | null; // null = permanent
  label: string;
};

function getBanParams(level: number): BanDurations {
  switch (level) {
    case 1: return { durationMs: 5 * 60 * 1000, label: "5 minutos" };
    case 2: return { durationMs: 60 * 60 * 1000, label: "1 hora" };
    case 3: return { durationMs: null, label: "hasta las 00:00 del día siguiente" }; // computed below
    default: return { durationMs: null, label: "permanente" }; // level 4+
  }
}

function computeExpiresAt(level: number): { expiresAt: Date; label: string } {
  const params = getBanParams(level);
  if (level === 3) {
    return { expiresAt: midnightNextDay(), label: params.label };
  }
  if (params.durationMs !== null) {
    return { expiresAt: new Date(Date.now() + params.durationMs), label: params.label };
  }
  // permanent
  return { expiresAt: new Date("2099-12-31T23:59:59Z"), label: params.label };
}

// ─── Check block status (used on page load) ────────────────────────────────────

export async function getBlockStatus(userId: string): Promise<{ blocked: boolean; blockedUntil: number | null; count: number; remaining: number; permanent: boolean; blockLevel: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { blocked: false, blockedUntil: null, count: 0, remaining: MISUSE_LIMIT, permanent: false, blockLevel: 0 };

  // Check for active permanent ban
  const activePermBan = await prisma.aiBan.findFirst({ where: { userId, status: "ACTIVE", level: 4 } });
  if (activePermBan) {
    return { blocked: true, blockedUntil: null, count: 0, remaining: 0, permanent: true, blockLevel: 4 };
  }

  const blockedUntil = user.aiBlockedUntil?.getTime() ?? null;
  if (blockedUntil && Date.now() < blockedUntil) {
    return { blocked: true, blockedUntil, count: user.aiMisuseCount, remaining: 0, permanent: false, blockLevel: user.aiBlockLevel };
  }

  if (blockedUntil) {
    await prisma.user.update({ where: { id: userId }, data: { aiMisuseCount: 0, aiBlockedUntil: null } });
  }

  return { blocked: false, blockedUntil: null, count: user.aiMisuseCount, remaining: MISUSE_LIMIT - user.aiMisuseCount, permanent: false, blockLevel: user.aiBlockLevel };
}

// ─── Main misuse check ─────────────────────────────────────────────────────────

export async function checkMisuse(userId: string, message: string): Promise<MisuseResult> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { allowed: true, blocked: false, count: 0, remaining: MISUSE_LIMIT, blockLevel: 0, blockedUntil: null, permanent: false, message: "" };
  }

  // Check for permanent ban first
  const activePermBan = await prisma.aiBan.findFirst({ where: { userId, status: "ACTIVE", level: 4 } });
  if (activePermBan) {
    return {
      allowed: false, blocked: true, count: 0, remaining: 0,
      blockLevel: 4, blockedUntil: null, permanent: true,
      message: "El asistente AI está bloqueado permanentemente por uso indebido. Contactá a un administrador para más información.",
    };
  }

  let count = user.aiMisuseCount;
  let blockedUntil = user.aiBlockedUntil?.getTime() ?? null;

  // Currently blocked
  if (blockedUntil && Date.now() < blockedUntil) {
    const remainingMs = blockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return {
      allowed: false, blocked: true, count, remaining: 0,
      blockLevel: user.aiBlockLevel, blockedUntil, permanent: false,
      message: `El asistente AI está bloqueado temporalmente por uso indebido. Volvé a intentar en ${remainingMin} minutos.`,
    };
  }

  // Block expired — reset
  if (blockedUntil) {
    count = 0;
    blockedUntil = null;
    await prisma.user.update({ where: { id: userId }, data: { aiMisuseCount: 0, aiBlockedUntil: null } });
  }

  // Conversational fillers — always allowed
  if (isConversationalFiller(message)) {
    return { allowed: true, blocked: false, count, remaining: MISUSE_LIMIT - count, blockLevel: user.aiBlockLevel, blockedUntil: null, permanent: false, message: "" };
  }

  // Financial query — allowed
  if (isFinancialQuery(message)) {
    return { allowed: true, blocked: false, count, remaining: MISUSE_LIMIT - count, blockLevel: user.aiBlockLevel, blockedUntil: null, permanent: false, message: "" };
  }

  // OFF_TOPIC — increment
  count += 1;
  const remaining = MISUSE_LIMIT - count;

  if (count >= MISUSE_LIMIT) {
    const newLevel = user.aiBlockLevel + 1;
    const { expiresAt, label } = computeExpiresAt(newLevel);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { aiMisuseCount: 0, aiBlockedUntil: newLevel >= 4 ? undefined : expiresAt, aiBlockLevel: newLevel },
      }),
      prisma.aiBan.create({
        data: {
          userId,
          level: newLevel,
          status: newLevel >= 4 ? "ACTIVE" : "ACTIVE",
          reason: `Uso indebido del asistente AI (nivel ${newLevel})`,
          expiresAt: newLevel >= 4 ? undefined : expiresAt,
        },
      }),
    ]);

    return {
      allowed: false, blocked: true, count: 0, remaining: 0,
      blockLevel: newLevel, blockedUntil: expiresAt.getTime(), permanent: newLevel >= 4,
      message: `Has alcanzado el límite de consultas fuera del alcance del asistente. El AI quedará bloqueado ${label}.`,
    };
  }

  await prisma.user.update({ where: { id: userId }, data: { aiMisuseCount: count } });

  return {
    allowed: false, blocked: false, count, remaining,
    blockLevel: user.aiBlockLevel, blockedUntil: null, permanent: false,
    message: `Esta consulta no está relacionada con finanzas personales. Te quedan ${remaining} intento${remaining === 1 ? "" : "s"} antes de un bloqueo.`,
  };
}
