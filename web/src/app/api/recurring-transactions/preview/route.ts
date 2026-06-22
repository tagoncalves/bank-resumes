import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { formatOccurrenceDates, generateOccurrenceDates, normalizeFrequency, normalizeInterval } from "@/lib/recurring/schedule";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  if (!body.anchorDate || !body.from || !body.to) {
    return NextResponse.json({ error: "Faltan fechas para previsualizar" }, { status: 400 });
  }

  const amountArs = Number(body.amountArs ?? 0);
  const amountUsd = body.amountUsd == null || body.amountUsd === "" ? null : Number(body.amountUsd);
  const dates = generateOccurrenceDates({
    anchorDate: body.anchorDate,
    frequency: normalizeFrequency(body.frequency),
    interval: normalizeInterval(body.interval),
    from: body.from,
    to: body.to,
    max: 121,
  });

  const visibleDates = dates.slice(0, 12);
  return NextResponse.json({
    count: Math.min(dates.length, 120),
    dates: formatOccurrenceDates(visibleDates),
    hasMore: dates.length > visibleDates.length,
    totalArs: Number.isFinite(amountArs) ? amountArs * Math.min(dates.length, 120) : 0,
    totalUsd: amountUsd != null && Number.isFinite(amountUsd) ? amountUsd * Math.min(dates.length, 120) : null,
    capped: dates.length > 120,
  });
}
