import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { ensureDefaultNotificationSetup, processNotifications } from "@/lib/notifications/engine";
import { EmailCarrier } from "@/lib/notifications/carriers/email";
import { formatMoney, renderTemplate } from "@/lib/notifications/template";

function parseChannelConfig(configJson?: string | null) {
  let config = {} as { provider?: string; from?: string; defaultRecipient?: string; apiKeyEnv?: string };
  try {
    config = configJson ? JSON.parse(configJson) as { provider?: string; from?: string; defaultRecipient?: string; apiKeyEnv?: string } : config;
  } catch {
    config = {};
  }

  if (process.env.EMAIL_PROVIDER) config.provider = process.env.EMAIL_PROVIDER;
  if (process.env.EMAIL_FROM && (!config.from || config.from.includes("sandbox"))) {
    config.from = process.env.EMAIL_FROM;
  }
  if (config.provider === "mailgun" && !config.apiKeyEnv) config.apiKeyEnv = "MAILGUN_API_KEY";

  return config;
}

function testTemplatePayload() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  return {
    merchantName: "Supermercado de prueba",
    amount: formatMoney(12345.67, "ARS"),
    currency: "ARS",
    dueDate: dueDate.toLocaleDateString("es-AR"),
    categoryName: "Gastos de prueba",
    confirmUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin/notifications?test=confirm`,
    rejectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/admin/notifications?test=reject`,
  };
}

function recipientForTest(
  requestedRecipient: unknown,
  config: { defaultRecipient?: string },
  user: { username: string; email: string | null } | null,
) {
  if (typeof requestedRecipient === "string" && requestedRecipient.trim()) return requestedRecipient.trim();
  if (config.defaultRecipient?.trim()) return config.defaultRecipient.trim();
  if (process.env.NOTIFICATION_DEFAULT_EMAIL) return process.env.NOTIFICATION_DEFAULT_EMAIL;
  if (user?.email) return user.email;
  if (user?.username.includes("@")) return user.username;
  return null;
}

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
  const { session, deny } = await requireAdmin();
  if (deny) return deny;

  const body = await request.json().catch(() => ({}));
  if (body.action === "process") {
    return NextResponse.json(await processNotifications());
  }

  if (body.action === "resend" && body.deliveryId) {
    const original = await prisma.notificationDelivery.findUnique({
      where: { id: body.deliveryId },
      include: { channel: true },
    });
    if (!original) return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 });
    if (original.channel.type !== "EMAIL") {
      return NextResponse.json({ error: "Reenvío implementado solo para email en el MVP" }, { status: 400 });
    }

    const retry = await prisma.notificationDelivery.create({
      data: {
        eventId: original.eventId,
        channelId: original.channelId,
        recipient: original.recipient,
        renderedSubject: original.renderedSubject,
        renderedBody: original.renderedBody,
        status: "PENDING",
      },
      include: { channel: true },
    });

    try {
      const config = parseChannelConfig(retry.channel.configJson);
      const result = await new EmailCarrier().send({
        recipient: retry.recipient,
        from: config.from,
        provider: config.provider,
        apiKeyEnv: config.apiKeyEnv,
        subject: retry.renderedSubject,
        body: retry.renderedBody,
        bodyFormat: "HTML",
      });

      const updated = await prisma.notificationDelivery.update({
        where: { id: retry.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          attemptCount: 1,
          lastError: null,
        },
      });
      return NextResponse.json(updated);
    } catch (error) {
      const failed = await prisma.notificationDelivery.update({
        where: { id: retry.id },
        data: {
          status: "FAILED",
          attemptCount: 1,
          lastError: error instanceof Error ? error.message : "Error al reenviar",
        },
      });
      return NextResponse.json(failed, { status: 500 });
    }
  }

  if (body.action === "deleteDelivery" && body.deliveryId) {
    const delivery = await prisma.notificationDelivery.findUnique({
      where: { id: body.deliveryId },
      select: { id: true, eventId: true, status: true },
    });
    if (!delivery) return NextResponse.json({ error: "Envío no encontrado" }, { status: 404 });
    if (!["PENDING", "RETRYING", "FAILED"].includes(delivery.status)) {
      return NextResponse.json({ error: "Solo se pueden eliminar envíos pendientes, en reintento o fallidos" }, { status: 400 });
    }

    await prisma.notificationDelivery.delete({ where: { id: delivery.id } });
    const remainingDeliveries = await prisma.notificationDelivery.count({ where: { eventId: delivery.eventId } });
    if (remainingDeliveries === 0) {
      await prisma.notificationEvent.update({ where: { id: delivery.eventId }, data: { status: "CANCELLED" } });
    }

    return NextResponse.json({ ok: true });
  }

  if (body.action === "testTemplate" && body.templateId) {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: body.templateId },
      include: { channel: true },
    });
    if (!template) return NextResponse.json({ error: "Template no encontrado" }, { status: 404 });
    if (template.channel.type !== "EMAIL") {
      return NextResponse.json({ error: "Prueba implementada solo para email en el MVP" }, { status: 400 });
    }

    const [user, config] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { username: true, email: true } }),
      Promise.resolve(parseChannelConfig(template.channel.configJson)),
    ]);
    const recipient = recipientForTest(body.recipient, config, user);
    if (!recipient) {
      return NextResponse.json(
        { error: "Configurá un destinatario default o pasá un email para enviar la prueba" },
        { status: 400 },
      );
    }

    const payload = testTemplatePayload();
    const event = await prisma.notificationEvent.create({
      data: {
        userId: session.userId,
        eventType: `TEST_${template.eventType}`,
        payloadJson: JSON.stringify(payload),
      },
    });
    const delivery = await prisma.notificationDelivery.create({
      data: {
        eventId: event.id,
        channelId: template.channelId,
        recipient,
        renderedSubject: template.subject ? `[Prueba] ${renderTemplate(template.subject, payload)}` : "[Prueba] Notificación Bank Resumes",
        renderedBody: renderTemplate(template.body, payload),
        status: "PENDING",
      },
    });

    try {
      const result = await new EmailCarrier().send({
        recipient,
        from: config.from,
        provider: config.provider,
        apiKeyEnv: config.apiKeyEnv,
        subject: delivery.renderedSubject,
        body: delivery.renderedBody,
        bodyFormat: template.bodyFormat,
      });

      const updated = await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          attemptCount: 1,
          lastError: null,
        },
      });
      await prisma.notificationEvent.update({ where: { id: event.id }, data: { status: "SENT" } });
      return NextResponse.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al enviar prueba";
      const failed = await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: "FAILED", attemptCount: 1, lastError: message },
      });
      await prisma.notificationEvent.update({ where: { id: event.id }, data: { status: "FAILED" } });
      return NextResponse.json({ ...failed, error: message }, { status: 500 });
    }
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
