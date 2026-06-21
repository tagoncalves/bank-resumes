import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ensureDefaultNotificationSetup, processNotifications } from "@/lib/notifications/engine";

function rangeFor(scope: string | null) {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  if (scope === "month") {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
    to.setMonth(to.getMonth() + 1, 1);
    to.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (scope === "week") {
    const day = from.getDay() || 7;
    from.setDate(from.getDate() - day + 1);
    from.setHours(0, 0, 0, 0);
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 7);
    return { from, to };
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export async function GET(request: Request) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  await ensureDefaultNotificationSetup();

  const url = new URL(request.url);
  const pendingRange = rangeFor(url.searchParams.get("pendingScope") ?? "day");
  const sentRange = rangeFor(url.searchParams.get("sentScope") ?? "day");

  const [channels, templates, events, pendingDeliveries, sentDeliveries] = await Promise.all([
    prisma.notificationChannel.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    prisma.notificationTemplate.findMany({ include: { channel: true }, orderBy: [{ eventType: "asc" }] }),
    prisma.notificationEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { deliveries: true } }),
    prisma.notificationDelivery.findMany({
      where: {
        status: { in: ["PENDING", "RETRYING", "FAILED"] },
        createdAt: { gte: pendingRange.from, lt: pendingRange.to },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
      include: { channel: true, event: true },
    }),
    prisma.notificationDelivery.findMany({
      where: {
        status: "SENT",
        sentAt: { gte: sentRange.from, lt: sentRange.to },
      },
      orderBy: { sentAt: "desc" },
      take: 50,
      include: { channel: true, event: true },
    }),
  ]);

  return NextResponse.json({ channels, templates, events, pendingDeliveries, sentDeliveries });
}

export async function POST(request: Request) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const body = await request.json().catch(() => ({}));
  if (body.action === "process") {
    return NextResponse.json(await processNotifications());
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}

export async function PATCH(request: Request) {
  const { deny } = await requireAdmin();
  if (deny) return deny;

  const body = await request.json();
  if (body.templateId) {
    const updated = await prisma.notificationTemplate.update({
      where: { id: body.templateId },
      data: {
        subject: body.subject ?? undefined,
        body: body.body ?? undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      },
    });
    return NextResponse.json(updated);
  }

  if (body.channelId) {
    const existing = await prisma.notificationChannel.findUnique({ where: { id: body.channelId } });
    let config: Record<string, unknown> = {};
    try {
      config = existing?.configJson ? JSON.parse(existing.configJson) as Record<string, unknown> : {};
    } catch {
      config = {};
    }
    if (body.config && typeof body.config === "object") {
      Object.assign(config, body.config);
    }

    const updated = await prisma.notificationChannel.update({
      where: { id: body.channelId },
      data: {
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        isDefault: typeof body.isDefault === "boolean" ? body.isDefault : undefined,
        configJson: body.config ? JSON.stringify(config) : undefined,
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "templateId o channelId requerido" }, { status: 400 });
}
