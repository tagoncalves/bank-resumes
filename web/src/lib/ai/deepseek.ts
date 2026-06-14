import type { AIAnalysisArtifacts, AIParsedStatement, ParsedBalanceSummary, ParsedHeader, ParsedTransaction } from "@/lib/pdf-parser/types";

export const DEEPSEEK_PROMPT_VERSION = "2026-06-13-v1";

type DeepSeekChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

function getDeepSeekConfig() {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("Banco no reconocido por el parser nativo y DeepSeek no está configurado. Definí DEEPSEEK_API_KEY para habilitar el mapeo asistido por AI.");
  }

  return {
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  };
}

function parseNumber(value: unknown, fieldName: string): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".").trim();
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }

  throw new Error(`Campo numérico inválido: ${fieldName}`);
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  return parseNumber(value, "optional");
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Campo requerido inválido: ${fieldName}`);
  }

  return value.trim();
}

function normalizeCardLastFour(value: unknown): string {
  const raw = parseRequiredString(value, "header.card_last_four");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) {
    throw new Error("No se pudieron obtener los últimos 4 dígitos de la tarjeta desde la respuesta AI");
  }

  return digits.slice(-4);
}

function normalizeDate(value: unknown, fieldName: string): string {
  const raw = parseRequiredString(value, fieldName);
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDate.test(raw)) return raw;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida en ${fieldName}`);
  }

  return date.toISOString().slice(0, 10);
}

function normalizeHeader(value: unknown): ParsedHeader {
  if (!value || typeof value !== "object") {
    throw new Error("Header AI inválido");
  }

  const header = value as Record<string, unknown>;
  return {
    bank_name: parseRequiredString(header.bank_name, "header.bank_name"),
    holder_name: parseRequiredString(header.holder_name, "header.holder_name"),
    account_number: typeof header.account_number === "string" && header.account_number.trim() ? header.account_number.trim() : undefined,
    card_last_four: normalizeCardLastFour(header.card_last_four),
    card_network: parseRequiredString(header.card_network, "header.card_network"),
    period_start: normalizeDate(header.period_start, "header.period_start"),
    period_end: normalizeDate(header.period_end, "header.period_end"),
    due_date: normalizeDate(header.due_date, "header.due_date"),
  };
}

function normalizeBalanceSummary(value: unknown): ParsedBalanceSummary {
  if (!value || typeof value !== "object") {
    throw new Error("Balance summary AI inválido");
  }

  const summary = value as Record<string, unknown>;
  return {
    currency: typeof summary.currency === "string" && summary.currency.trim() ? summary.currency.trim() : "ARS",
    previous_balance: parseNumber(summary.previous_balance ?? 0, "balance_summary.previous_balance"),
    previous_balance_usd: parseOptionalNumber(summary.previous_balance_usd),
    payments_applied: parseNumber(summary.payments_applied ?? 0, "balance_summary.payments_applied"),
    total_consumption: parseNumber(summary.total_consumption ?? 0, "balance_summary.total_consumption"),
    commission_cuenta_full: parseNumber(summary.commission_cuenta_full ?? 0, "balance_summary.commission_cuenta_full"),
    sello_tax: parseNumber(summary.sello_tax ?? 0, "balance_summary.sello_tax"),
    iva_tax: parseNumber(summary.iva_tax ?? 0, "balance_summary.iva_tax"),
    iibb_tax: parseNumber(summary.iibb_tax ?? 0, "balance_summary.iibb_tax"),
    financing_interest: parseNumber(summary.financing_interest ?? 0, "balance_summary.financing_interest"),
    current_balance: parseNumber(summary.current_balance ?? 0, "balance_summary.current_balance"),
    current_balance_usd: parseOptionalNumber(summary.current_balance_usd),
    minimum_payment: parseNumber(summary.minimum_payment ?? 0, "balance_summary.minimum_payment"),
    tna_ars: parseOptionalNumber(summary.tna_ars),
    tem_ars: parseOptionalNumber(summary.tem_ars),
    tea_ars: parseOptionalNumber(summary.tea_ars),
    tna_usd: parseOptionalNumber(summary.tna_usd),
    tem_usd: parseOptionalNumber(summary.tem_usd),
    tea_usd: parseOptionalNumber(summary.tea_usd),
  };
}

function normalizeTransactions(value: unknown, fallbackLastFour: string): ParsedTransaction[] {
  if (!Array.isArray(value)) {
    throw new Error("Transactions AI inválidas");
  }

  return value.map((transaction, index) => {
    if (!transaction || typeof transaction !== "object") {
      throw new Error(`Transacción AI inválida en posición ${index}`);
    }

    const tx = transaction as Record<string, unknown>;
    return {
      date: normalizeDate(tx.date, `transactions[${index}].date`),
      merchant_name: parseRequiredString(tx.merchant_name, `transactions[${index}].merchant_name`),
      voucher_number: typeof tx.voucher_number === "string" && tx.voucher_number.trim() ? tx.voucher_number.trim() : undefined,
      installment_current: tx.installment_current == null ? undefined : Math.trunc(parseNumber(tx.installment_current, `transactions[${index}].installment_current`)),
      installment_total: tx.installment_total == null ? undefined : Math.trunc(parseNumber(tx.installment_total, `transactions[${index}].installment_total`)),
      amount_ars: parseNumber(tx.amount_ars ?? 0, `transactions[${index}].amount_ars`),
      amount_usd: parseOptionalNumber(tx.amount_usd),
      card_last_four: typeof tx.card_last_four === "string" && tx.card_last_four.trim() ? normalizeCardLastFour(tx.card_last_four) : fallbackLastFour,
    };
  });
}

function normalizeConsistency(value: unknown, localNotes: string[]) {
  const consistency = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const notes = Array.isArray(consistency.notes)
    ? consistency.notes.filter((note): note is string => typeof note === "string" && !!note.trim()).map((note) => note.trim())
    : [];

  const confidence = typeof consistency.confidence === "number" && Number.isFinite(consistency.confidence)
    ? Math.min(1, Math.max(0, consistency.confidence))
    : 0.5;

  const passed = typeof consistency.passed === "boolean" ? consistency.passed : true;

  return {
    passed: passed && localNotes.length === 0,
    confidence,
    notes: [...notes, ...localNotes],
  };
}

function evaluateLocalConsistency(header: ParsedHeader, balanceSummary: ParsedBalanceSummary, transactions: ParsedTransaction[]): string[] {
  const notes: string[] = [];

  const periodStart = new Date(header.period_start);
  const periodEnd = new Date(header.period_end);
  const dueDate = new Date(header.due_date);

  if (periodStart > periodEnd) {
    notes.push("El período inicial es posterior al período final.");
  }

  if (dueDate < periodStart) {
    notes.push("La fecha de vencimiento quedó antes del período informado.");
  }

  const arsConsumption = transactions.reduce((sum, tx) => sum + Math.max(0, tx.amount_ars), 0);
  const deltaConsumption = Math.abs(arsConsumption - balanceSummary.total_consumption);
  const tolerance = Math.max(2, balanceSummary.total_consumption * 0.05);

  if (transactions.length > 0 && deltaConsumption > tolerance) {
    notes.push(`La suma de movimientos ARS difiere del total de consumos en ${deltaConsumption.toFixed(2)}.`);
  }

  if (balanceSummary.minimum_payment > balanceSummary.current_balance + 2) {
    notes.push("El pago mínimo supera al saldo actual informado.");
  }

  return notes;
}

export async function analyzeStatementWithDeepSeek(pdfText: string, filename: string): Promise<{
  statement: AIParsedStatement;
  artifacts: AIAnalysisArtifacts;
}> {
  const { apiKey, baseUrl, model } = getDeepSeekConfig();
  const sourceTextExcerpt = pdfText.slice(0, 40000);

  const prompt = [
    "Sos un analista experto en resumenes de tarjeta argentinos.",
    "Debés leer el texto OCR de un PDF y devolver exclusivamente JSON válido.",
    "Extraé: header, balance_summary, transactions y consistency.",
    "No omitas bank_name, holder_name, card_last_four, card_network, period_start, period_end, due_date.",
    "Usá fechas en formato YYYY-MM-DD.",
    "Usá montos numéricos, sin símbolos de moneda ni separadores de miles.",
    "En consistency devolvé passed:boolean, confidence:0..1 y notes:string[].",
    "Si una transacción no tiene amount_usd, dejala vacía.",
    `Archivo: ${filename}`,
    "Texto del PDF:",
    sourceTextExcerpt,
  ].join("\n\n");

  const requestPayload = JSON.stringify({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Respondé solo con JSON estricto y sin markdown.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: requestPayload,
  });

  const payload = await response.json() as DeepSeekChatResponse;

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "DeepSeek devolvió un error al analizar el resumen");
  }

  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("DeepSeek no devolvió contenido utilizable");
  }

  let parsedContent: unknown;
  try {
    parsedContent = JSON.parse(rawContent);
  } catch {
    throw new Error("La respuesta de DeepSeek no fue JSON válido");
  }

  const normalized = parsedContent as Record<string, unknown>;
  const header = normalizeHeader(normalized.header);
  const balanceSummary = normalizeBalanceSummary(normalized.balance_summary);
  const transactions = normalizeTransactions(normalized.transactions, header.card_last_four);
  const localNotes = evaluateLocalConsistency(header, balanceSummary, transactions);
  const consistency = normalizeConsistency(normalized.consistency, localNotes);

  const statement: AIParsedStatement = {
    header,
    balance_summary: balanceSummary,
    transactions,
    parser_version: `deepseek:${model}`,
    consistency,
  };

  return {
    statement,
    artifacts: {
      source_text_excerpt: sourceTextExcerpt,
      request_payload: requestPayload,
      raw_response: rawContent,
      parsed_result_json: JSON.stringify(statement, null, 2),
      model,
      prompt_version: DEEPSEEK_PROMPT_VERSION,
    },
  };
}
