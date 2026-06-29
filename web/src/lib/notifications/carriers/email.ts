import type { NotificationCarrier, SendNotificationInput } from "@/lib/notifications/carriers/types";
import { sendEmail } from "@/lib/email/mailgun";

export class EmailCarrier implements NotificationCarrier {
  type = "EMAIL";

  async send(input: SendNotificationInput) {
    const provider = input.provider ?? process.env.EMAIL_PROVIDER ?? "console";

    if (provider === "mailgun") {
      return sendEmail({
        to: input.recipient,
        from: input.from,
        apiKeyEnv: input.apiKeyEnv,
        subject: input.subject ?? "Notificación Bank Resumes",
        html: input.bodyFormat === "HTML" ? input.body : undefined,
        text: input.bodyFormat === "HTML" ? undefined : input.body,
      });
    }

    if (provider !== "console") {
      throw new Error(`Proveedor de email no soportado: ${provider}`);
    }

    console.info("[notification:email]", {
      provider,
      from: input.from ?? process.env.EMAIL_FROM ?? "Bank Resumes <no-reply@example.com>",
      to: input.recipient,
      subject: input.subject,
      body: input.body,
    });
    return { providerMessageId: `console-${Date.now()}` };
  }
}
