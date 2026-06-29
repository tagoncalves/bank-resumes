import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decimalToNumber, createManualTransactionForUser } from "@/lib/transactions/create-transaction";
import { defaultTemplates, formatMoney, renderTemplate } from "@/lib/notifications/template";
import { EmailCarrier } from "@/lib/notifications/carriers/email";
import { advanceRecurringDate } from "@/lib/recurring/schedule";

const EVENT_RECURRENT_REMINDER = "RECURRENT_TRANSACTION_REMINDER";
const EVENT_RECURRENT_CREATED = "RECURRENT_TRANSACTION_CREATED";

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function ensureDefaultNotificationSetup() {
  let channel = await prisma.notificationChannel.upsert({
    where: { name: "EMAIL_DEFAULT" },
    update: { type: "EMAIL", isDefault: true },
    create: {
      name: "EMAIL_DEFAULT",
      type: "EMAIL",
      enabled: true,
      isDefault: true,
      configJson: JSON.stringify({
        provider: process.env.EMAIL_PROVIDER ?? "console",
        from: process.env.EMAIL_FROM ?? "Bank Resumes <no-reply@example.com>",
        defaultRecipient: process.env.NOTIFICATION_DEFAULT_EMAIL ?? "",
      }),
    },
  });

  const config = parseChannelConfig(channel.configJson);
  const nextConfig = { ...config };
  if (process.env.EMAIL_PROVIDER && nextConfig.provider !== process.env.EMAIL_PROVIDER) {
    nextConfig.provider = process.env.EMAIL_PROVIDER;
  }
  if (process.env.EMAIL_FROM && (!nextConfig.from || nextConfig.from.includes("sandbox"))) {
    nextConfig.from = process.env.EMAIL_FROM;
  }
  if (!nextConfig.defaultRecipient && process.env.NOTIFICATION_DEFAULT_EMAIL) {
    nextConfig.defaultRecipient = process.env.NOTIFICATION_DEFAULT_EMAIL;
  }
  if (nextConfig.provider === "mailgun" && !nextConfig.apiKeyEnv) {
    nextConfig.apiKeyEnv = "MAILGUN_API_KEY";
  }

  if (JSON.stringify(config) !== JSON.stringify(nextConfig)) {
    channel = await prisma.notificationChannel.update({
      where: { id: channel.id },
      data: { configJson: JSON.stringify(nextConfig) },
    });
  }

  const templates = defaultTemplates();
  for (const [eventType, template] of Object.entries(templates)) {
    await prisma.notificationTemplate.upsert({
      where: { channelId_eventType: { channelId: channel.id, eventType } },
      update: {},
      create: {
        channelId: channel.id,
        eventType,
        subject: template.subject,
        body: template.body,
        bodyFormat: template.bodyFormat,
      },
    });
  }

  return channel;
}

function parseChannelConfig(configJson?: string | null) {
  if (!configJson) return {} as { from?: string; defaultRecipient?: string; provider?: string; apiKeyEnv?: string };
  try {
    return JSON.parse(configJson) as { from?: string; defaultRecipient?: string; provider?: string; apiKeyEnv?: string };
  } catch {
    return {} as { from?: string; defaultRecipient?: string; provider?: string; apiKeyEnv?: string };
  }
}

function recipientForUser(user: { username: string }, config: { defaultRecipient?: string }) {
  if (config.defaultRecipient) return config.defaultRecipient;
  if (process.env.NOTIFICATION_DEFAULT_EMAIL) return process.env.NOTIFICATION_DEFAULT_EMAIL;
  if (user.username.includes("@")) return user.username;
  return null;
}

async function createEventOnce(data: {
  userId: string;
  eventType: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  scheduledFor?: Date;
}) {
  return prisma.notificationEvent.upsert({
    where: { dedupeKey: data.dedupeKey },
    update: {},
    create: {
      userId: data.userId,
      eventType: data.eventType,
      payloadJson: JSON.stringify(data.payload),
      dedupeKey: data.dedupeKey,
      scheduledFor: data.scheduledFor ?? new Date(),
    },
  });
}

async function generateRecurringReminders(now: Date) {
  const recurring = await prisma.recurringTransaction.findMany({
    where: { enabled: true },
    include: { user: true, category: true },
  });

  let generated = 0;

  for (const item of recurring) {
    let dueDate = item.nextRunAt;
    let nextRunAt = item.nextRunAt;
    let safety = 0;

    while (safety < 24) {
      if (item.endDate && dueDate > item.endDate) break;

      const reminderDate = addDays(dueDate, -item.reminderDaysBefore);
      if (reminderDate > now) break;

      const occurrence = await prisma.recurringTransactionOccurrence.upsert({
        where: { recurringTransactionId_dueDate: { recurringTransactionId: item.id, dueDate } },
        update: {},
        create: {
          recurringTransactionId: item.id,
          dueDate,
          status: "PENDING",
          expiresAt: addDays(dueDate, 7),
          generationType: "FUTURE",
        },
      });

      if (item.requiresConfirmation) {
        if (["PENDING", "NOTIFIED"].includes(occurrence.status)) {
          const payload = recurringPayload(item, occurrence.id, dueDate);
          const event = await createEventOnce({
            userId: item.userId,
            eventType: EVENT_RECURRENT_REMINDER,
            payload,
            dedupeKey: `recurring:${occurrence.id}:reminder`,
          });

          await prisma.recurringTransactionOccurrence.update({
            where: { id: occurrence.id },
            data: { status: "NOTIFIED", notificationEventId: event.id, createdByMode: "CONFIRMATION" },
          });
          generated += 1;
        }
      } else if (dueDate <= now && occurrence.status === "PENDING") {
        const tx = await createManualTransactionForUser(item.userId, {
          date: dueDate,
          merchantName: item.merchantName,
          amountArs: decimalToNumber(item.amountArs),
          amountUsd: item.amountUsd == null ? null : decimalToNumber(item.amountUsd),
          categoryId: item.categoryId,
          transactionType: item.transactionType,
          source: "RECURRENT",
        });

        await prisma.recurringTransactionOccurrence.update({
          where: { id: occurrence.id },
          data: { status: "EXECUTED", transactionId: tx.id, createdByMode: "AUTO" },
        });

        await createEventOnce({
          userId: item.userId,
          eventType: EVENT_RECURRENT_CREATED,
          payload: recurringPayload(item, occurrence.id, dueDate),
          dedupeKey: `recurring:${occurrence.id}:created`,
        });
        generated += 1;
      }

      if (dueDate > now) break;
      nextRunAt = advanceRecurringDate(dueDate, item.frequency, item.interval, item.anchorDate ?? item.nextRunAt);
      dueDate = nextRunAt;
      safety += 1;
    }

    if (nextRunAt.getTime() !== item.nextRunAt.getTime()) {
      await prisma.recurringTransaction.update({
        where: { id: item.id },
        data: { nextRunAt, lastGeneratedAt: now },
      });
    }
  }

  return generated;
}

function recurringPayload(
  item: Prisma.RecurringTransactionGetPayload<{ include: { user: true; category: true } }>,
  occurrenceId: string,
  dueDate = item.nextRunAt,
) {
  const amount = formatMoney(decimalToNumber(item.amountArs), item.currency);
  return {
    occurrenceId,
    recurringTransactionId: item.id,
    merchantName: item.merchantName,
    amount,
    currency: item.currency,
    dueDate: dueDate.toLocaleDateString("es-AR"),
    categoryName: item.category?.name ?? "Sin categoría",
    confirmUrl: `${appUrl()}/admin/notifications?occurrenceId=${occurrenceId}`,
    rejectUrl: `${appUrl()}/admin/notifications?occurrenceId=${occurrenceId}`,
  };
}

async function createDeliveriesForPendingEvents(now: Date) {
  const channel = await ensureDefaultNotificationSetup();
  const events = await prisma.notificationEvent.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    include: { user: true, deliveries: true },
    take: 20,
  });

  let created = 0;
  for (const event of events) {
    if (event.deliveries.length > 0) continue;
    if (!event.user) {
      await prisma.notificationEvent.update({ where: { id: event.id }, data: { status: "FAILED" } });
      continue;
    }

    const channelConfig = parseChannelConfig(channel.configJson);
    const recipient = recipientForUser(event.user, channelConfig);
    if (!recipient) {
      await prisma.notificationEvent.update({ where: { id: event.id }, data: { status: "FAILED" } });
      continue;
    }

    const template = await prisma.notificationTemplate.findUnique({
      where: { channelId_eventType: { channelId: channel.id, eventType: event.eventType } },
    });
    if (!template || !template.enabled) {
      await prisma.notificationEvent.update({ where: { id: event.id }, data: { status: "FAILED" } });
      continue;
    }

    const payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
    await prisma.notificationDelivery.create({
      data: {
        eventId: event.id,
        channelId: channel.id,
        recipient,
        renderedSubject: template.subject ? renderTemplate(template.subject, payload) : null,
        renderedBody: renderTemplate(template.body, payload),
      },
    });
    created += 1;
  }

  return created;
}

async function sendPendingDeliveries(now: Date) {
  const carrier = new EmailCarrier();
  const deliveries = await prisma.notificationDelivery.findMany({
    where: {
      status: { in: ["PENDING", "RETRYING"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    include: { channel: true, event: true },
    take: 20,
  });

  let sent = 0;
  for (const delivery of deliveries) {
    try {
      const result = await carrier.send({
        recipient: delivery.recipient,
        from: parseChannelConfig(delivery.channel.configJson).from,
        provider: parseChannelConfig(delivery.channel.configJson).provider,
        apiKeyEnv: parseChannelConfig(delivery.channel.configJson).apiKeyEnv,
        subject: delivery.renderedSubject,
        body: delivery.renderedBody,
        bodyFormat: "HTML",
      });

      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: result.providerMessageId ?? null,
          attemptCount: { increment: 1 },
          lastError: null,
        },
      });
      await prisma.notificationEvent.update({ where: { id: delivery.eventId }, data: { status: "SENT" } });
      sent += 1;
    } catch (error) {
      const attempts = delivery.attemptCount + 1;
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: attempts >= 3 ? "FAILED" : "RETRYING",
          attemptCount: attempts,
          lastError: error instanceof Error ? error.message : "Error al enviar",
          nextRetryAt: attempts >= 3 ? null : addDays(now, 1),
        },
      });
      await prisma.notificationEvent.update({ where: { id: delivery.eventId }, data: { status: attempts >= 3 ? "FAILED" : "PENDING" } });
    }
  }

  return sent;
}

export async function processNotifications() {
  const now = new Date();
  await ensureDefaultNotificationSetup();
  const generated = await generateRecurringReminders(now);
  const deliveryCreated = await createDeliveriesForPendingEvents(now);
  const sent = await sendPendingDeliveries(now);
  return { generated, deliveryCreated, sent };
}
