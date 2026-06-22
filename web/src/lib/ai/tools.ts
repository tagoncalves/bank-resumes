import { prisma } from "@/lib/prisma";
import { toMoneyNumber, toNullableMoneyNumber } from "@/lib/money";
import { parseDateRangeEnd, parseDateRangeStart } from "@/lib/dates";

// ─── Tool definitions (sent to the model) ──────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "get_dashboard_summary",
      description: "Obtener un resumen financiero agregado: ingresos, egresos, balance neto, gastos por categoría, tendencia mensual y top comercios.",
      parameters: {
        type: "object",
        properties: {
          months: {
            type: "number",
            description: "Cantidad de meses hacia atrás (default: 6)",
          },
          origin: {
            type: "string",
            description: 'Filtrar por origen: "all", "manual", "statement", "payslip" o combinación separada por comas',
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_transactions",
      description: "Buscar movimientos con filtros. Útil para responder preguntas específicas sobre gastos, ingresos, comercios, cuotas, etc.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: { type: "string", description: "Fecha desde (YYYY-MM-DD)" },
          dateTo: { type: "string", description: "Fecha hasta (YYYY-MM-DD)" },
          categoryName: { type: "string", description: "Filtrar por nombre de categoría (ej. Supermercado, Transporte)" },
          transactionType: { type: "string", enum: ["CREDIT", "DEBIT"], description: "Tipo de movimiento" },
          origin: { type: "string", description: 'Origen: "manual", "statement", "payslip"' },
          search: { type: "string", description: "Buscar por nombre de comercio" },
          limit: { type: "number", description: "Cantidad máxima de resultados (default: 20, max: 100)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_statements",
      description: "Listar resúmenes de tarjeta. Devuelve período, banco, saldos, vencimiento, consumos totales, impuestos.",
      parameters: {
        type: "object",
        properties: {
          bankName: { type: "string", description: "Filtrar por nombre del banco" },
          limit: { type: "number", description: "Cantidad máxima (default: 5, max: 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payslips",
      description: "Listar recibos de sueldo. Devuelve empleador, período, neto, bruto y banco.",
      parameters: {
        type: "object",
        properties: {
          bankName: { type: "string", description: "Filtrar por nombre del banco" },
          limit: { type: "number", description: "Cantidad máxima (default: 5, max: 20)" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_exchange_rates",
      description: "Obtener cotizaciones actualizadas de dólar y monedas en Argentina (DolarAPI). Tipos: oficial, blue, bolsa/MEP, contadoconliqui/CCL, tarjeta, mayorista, cripto. Otras monedas: eur, brl, clp, uyu. Si no se especifica tipo, devuelve todas.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["oficial", "blue", "bolsa", "contadoconliqui", "tarjeta", "mayorista", "cripto", "eur", "brl", "clp", "uyu"],
            description: 'Tipo de cotización. "bolsa" = MEP, "contadoconliqui" = CCL. Si se omite devuelve todos los dólares.',
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_inflation",
      description: "Obtener datos de inflación mensual (IPC) de Argentina desde Anduin API. Devuelve serie histórica con fecha y valor. Útil para preguntar por el último dato, la evolución o un período específico.",
      parameters: {
        type: "object",
        properties: {
          dateFrom: { type: "string", description: "Fecha desde (YYYY-MM-DD) para filtrar" },
          dateTo: { type: "string", description: "Fecha hasta (YYYY-MM-DD) para filtrar" },
        },
      },
    },
  },
];

// ─── Types ──────────────────────────────────────────────────────────────────────

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const blocked = new Set(["passwordHash", "accountNumber", "id", "userId", "statementId", "categoryId", "cardId", "incomeTransactionId", "sourceHash", "analysisStructuredJson", "aiRequestPayload", "aiRawResponse", "aiParsedResult", "sourceTextExcerpt"]);
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (blocked.has(key)) continue;
      result[key] = sanitize(val);
    }
    return result;
  }
  return value;
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) + "..." : value;
}

// ─── Tool handlers ──────────────────────────────────────────────────────────────

async function handleDashboardSummary(userId: string, args: Record<string, unknown>) {
  const months = (args.months as number) ?? 6;
  const origin = (args.origin as string) ?? "all";

  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const userFilter = { userId };
  const txPeriodFilter = { ...userFilter, deletedAt: null as null, date: { gte: since, lte: now } };

  const selectedOrigins = origin.split(",").filter(Boolean);
  const originClauses: Record<string, unknown>[] = [];
  if (selectedOrigins.includes("manual")) originClauses.push({ source: "MANUAL" });
  if (selectedOrigins.includes("statement")) originClauses.push({ statementId: { not: null } });
  if (selectedOrigins.includes("payslip")) originClauses.push({ payslip: { isNot: null } });
  const originFilter = !selectedOrigins.length || selectedOrigins.includes("all") ? {} : { OR: originClauses };
  const scopedFilter = { ...txPeriodFilter, ...originFilter };

  const [incomeAgg, expenseAgg, txByCategory, categories] = await Promise.all([
    prisma.transaction.aggregate({ where: { ...scopedFilter, transactionType: "CREDIT" }, _sum: { amountArs: true, amountUsd: true } }),
    prisma.transaction.aggregate({ where: { ...scopedFilter, transactionType: "DEBIT" }, _sum: { amountArs: true, amountUsd: true } }),
    prisma.transaction.groupBy({ by: ["categoryId"], where: { ...scopedFilter, transactionType: "DEBIT" }, _sum: { amountArs: true }, _count: { id: true }, orderBy: { _sum: { amountArs: "desc" } } }),
    prisma.category.findMany(),
  ]);

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const totalIncomeArs = toMoneyNumber(incomeAgg._sum.amountArs);
  const totalExpenseArs = toMoneyNumber(expenseAgg._sum.amountArs);
  const totalCatSpend = txByCategory.reduce((s, g) => s + toMoneyNumber(g._sum.amountArs), 0);

  return sanitize({
    periodo: `${since.toISOString().slice(0, 10)} a ${now.toISOString().slice(0, 10)}`,
    ingresos: { ars: totalIncomeArs, usd: toMoneyNumber(incomeAgg._sum.amountUsd) },
    egresos: { ars: totalExpenseArs, usd: toMoneyNumber(expenseAgg._sum.amountUsd) },
    balanceNeto: { ars: totalIncomeArs - totalExpenseArs },
    gastosPorCategoria: txByCategory.map((g) => {
      const cat = g.categoryId ? catMap.get(g.categoryId) : null;
      const total = toMoneyNumber(g._sum.amountArs);
      return {
        categoria: cat?.name ?? "Sin categoría",
        total,
        cantidad: g._count.id,
        porcentaje: totalCatSpend > 0 ? Math.round((total / totalCatSpend) * 100) : 0,
      };
    }),
  });
}

async function handleTransactions(userId: string, args: Record<string, unknown>) {
  const limit = Math.min((args.limit as number) ?? 20, 100);
  const where: Record<string, unknown> = { userId, deletedAt: null };

  if (args.dateFrom || args.dateTo) {
    where.date = {};
    if (args.dateFrom) (where.date as Record<string, unknown>).gte = parseDateRangeStart(args.dateFrom as string);
    if (args.dateTo) (where.date as Record<string, unknown>).lte = parseDateRangeEnd(args.dateTo as string);
  }
  if (args.transactionType) where.transactionType = args.transactionType;
  if (args.origin === "statement") where.statementId = { not: null };
  else if (args.origin === "payslip") where.payslip = { isNot: null };
  else if (args.origin === "manual") where.source = "MANUAL";
  if (args.categoryName) {
    const cat = await prisma.category.findFirst({ where: { name: { contains: args.categoryName as string } } });
    if (cat) where.categoryId = cat.id;
  }
  if (args.search) where.merchantName = { contains: args.search as string };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: where as any,
      orderBy: { date: "desc" },
      take: limit,
      include: { category: { select: { name: true } }, payslip: { select: { id: true } } },
    }),
    prisma.transaction.count({ where: where as any }),
  ]);

  const mapped = transactions.map((t) => ({
    fecha: t.date.toISOString().slice(0, 10),
    comercio: t.normalizedMerchant || t.merchantName,
    montoArs: toMoneyNumber(t.amountArs),
    montoUsd: toNullableMoneyNumber(t.amountUsd),
    tipo: t.transactionType === "CREDIT" ? "ingreso" : "gasto",
    origen: t.source === "MANUAL" ? "manual" : t.statementId ? "resumen" : t.payslip ? "recibo" : "importado",
    categoria: t.category?.name ?? null,
    cuotas: t.isInstallment ? `${t.installmentCurrent}/${t.installmentTotal}` : null,
    tarjeta: t.cardLastFour ?? null,
  }));

  return sanitize({ total, resultados: mapped.length, movimientos: mapped });
}

async function handleStatements(userId: string, args: Record<string, unknown>) {
  const limit = Math.min((args.limit as number) ?? 5, 20);
  const where: Record<string, unknown> = { userId };
  if (args.bankName) where.bankName = { contains: args.bankName as string };

  const statements = await prisma.statement.findMany({
    where: where as any,
    orderBy: { periodEnd: "desc" },
    take: limit,
    include: { balanceSummary: true, card: { select: { cardNetwork: true, lastFour: true, holderName: true } } },
  });

  const mapped = statements.map((s) => ({
    banco: s.bankName,
    periodo: `${s.periodStart.toISOString().slice(0, 10)} a ${s.periodEnd.toISOString().slice(0, 10)}`,
    vencimiento: s.dueDate.toISOString().slice(0, 10),
    tarjeta: `${s.card.cardNetwork} ·•••${s.card.lastFour}`,
    titular: s.card.holderName,
    importacion: s.importMethod,
    resumen: s.balanceSummary ? {
      saldoAnterior: toMoneyNumber(s.balanceSummary.previousBalance),
      saldoAnteriorUsd: toNullableMoneyNumber(s.balanceSummary.previousBalanceUsd),
      consumos: toMoneyNumber(s.balanceSummary.totalConsumption),
      pagos: toMoneyNumber(s.balanceSummary.paymentsApplied),
      comisiones: toMoneyNumber(s.balanceSummary.commissionCuentaFull),
      impuestoSello: toMoneyNumber(s.balanceSummary.selloTax),
      iva: toMoneyNumber(s.balanceSummary.ivaTax),
      iibb: toMoneyNumber(s.balanceSummary.iibbTax),
      intereses: toMoneyNumber(s.balanceSummary.financingInterest),
      saldoActual: toMoneyNumber(s.balanceSummary.currentBalance),
      saldoActualUsd: toNullableMoneyNumber(s.balanceSummary.currentBalanceUsd),
      pagoMinimo: toMoneyNumber(s.balanceSummary.minimumPayment),
    } : null,
  }));

  return sanitize({ resultados: mapped.length, resumenes: mapped });
}

async function handlePayslips(userId: string, args: Record<string, unknown>) {
  const limit = Math.min((args.limit as number) ?? 5, 20);
  const where: Record<string, unknown> = { userId };
  if (args.bankName) where.bankName = { contains: args.bankName as string };

  const payslips = await prisma.payslip.findMany({
    where: where as any,
    orderBy: { payDate: "desc" },
    take: limit,
  });

  const mapped = payslips.map((p) => ({
    empleador: p.employerName,
    empleado: p.employeeName,
    periodo: p.periodLabel,
    fechaPago: p.payDate?.toISOString().slice(0, 10) ?? null,
    neto: p.netAmount ? toMoneyNumber(p.netAmount) : null,
    bruto: p.grossAmount ? toMoneyNumber(p.grossAmount) : null,
    banco: p.bankName ?? null,
    estado: p.processingStatus === "COMPLETED" ? "procesado" : "pendiente",
  }));

  return sanitize({ resultados: mapped.length, recibos: mapped });
}

async function handleExchangeRates(_userId: string, args: Record<string, unknown>) {
  const tipo = args.tipo as string | undefined;
  const baseUrl = "https://dolarapi.com";

  try {
    if (tipo) {
      const isMoneda = ["eur", "brl", "clp", "uyu"].includes(tipo);
      const endpoint = isMoneda ? `/v1/cotizaciones/${tipo}` : `/v1/dolares/${tipo}`;
      const res = await fetch(`${baseUrl}${endpoint}`);
      if (!res.ok) return { error: `Cotización "${tipo}" no encontrada o no soportada.` };
      const data = await res.json();
      return sanitize({
        tipo: data.nombre ?? tipo,
        compra: data.compra,
        venta: data.venta,
        spread: data.venta - data.compra,
        actualizacion: data.fechaActualizacion,
      });
    }

    const res = await fetch(`${baseUrl}/v1/dolares`);
    if (!res.ok) return { error: "Error al obtener cotizaciones." };
    const data = await res.json();
    const mapped = (data as any[]).map((d: any) => ({
      tipo: d.nombre,
      compra: d.compra,
      venta: d.venta,
      spread: d.venta - d.compra,
      actualizacion: d.fechaActualizacion,
    }));
    return sanitize({ cotizaciones: mapped });
  } catch {
    return { error: "No se pudo conectar con el servicio de cotizaciones." };
  }
}

async function handleInflation(_userId: string, args: Record<string, unknown>) {
  const baseUrl = "https://anduin.ferminrp.com";

  try {
    const res = await fetch(`${baseUrl}/api/v1/indices/inflacion-mensual`);
    if (!res.ok) return { error: `Error al obtener datos de inflación (HTTP ${res.status}).` };
    const json = await res.json();
    if (!json.success) return { error: json.error?.message ?? "Error al obtener datos de inflación." };

    const datos: { fecha: string; valor: number }[] = json.data?.datos ?? [];
    if (!datos.length) return { error: "No hay datos de inflación disponibles." };

    const dateFrom = args.dateFrom as string | undefined;
    const dateTo = args.dateTo as string | undefined;

    let filtered = datos;
    if (dateFrom) filtered = filtered.filter((d) => d.fecha >= dateFrom);
    if (dateTo) filtered = filtered.filter((d) => d.fecha <= dateTo);

    const ultimo = filtered[filtered.length - 1];
    return sanitize({
      fuente: "Anduin API — IPC Argentina",
      totalRegistros: filtered.length,
      ultimoDato: ultimo ? { fecha: ultimo.fecha, valor: ultimo.valor } : null,
      fetchedAt: json.data?.fetchedAt ?? json.timestamp,
      serie: filtered.slice(-24).map((d) => ({ fecha: d.fecha, valor: d.valor })),
    });
  } catch {
    return { error: "No se pudo conectar con el servicio de inflación." };
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────────

export async function executeToolCall(userId: string, toolCall: ToolCall): Promise<{ role: string; tool_call_id: string; content: string }> {
  const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

  let result: unknown;

  switch (toolCall.function.name) {
    case "get_dashboard_summary":
      result = await handleDashboardSummary(userId, args);
      break;
    case "get_transactions":
      result = await handleTransactions(userId, args);
      break;
    case "get_statements":
      result = await handleStatements(userId, args);
      break;
    case "get_payslips":
      result = await handlePayslips(userId, args);
      break;
    case "get_exchange_rates":
      result = await handleExchangeRates(userId, args);
      break;
    case "get_inflation":
      result = await handleInflation(userId, args);
      break;
    default:
      result = { error: `Herramienta desconocida: ${toolCall.function.name}` };
  }

  return {
    role: "tool",
    tool_call_id: toolCall.id,
    content: JSON.stringify(result),
  };
}
