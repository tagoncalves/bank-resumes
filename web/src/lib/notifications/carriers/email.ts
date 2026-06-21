import type { NotificationCarrier, SendNotificationInput } from "@/lib/notifications/carriers/types";

export class EmailCarrier implements NotificationCarrier {
  type = "EMAIL";

  async send(input: SendNotificationInput) {
    const provider = input.provider ?? process.env.EMAIL_PROVIDER ?? "console";

    if (provider === "resend") {
      const apiKeyEnv = input.apiKeyEnv ?? "RESEND_API_KEY";
      const apiKey = process.env[apiKeyEnv] ?? process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error(`Falta configurar ${apiKeyEnv} para enviar por Resend`);
      }

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: input.from ?? process.env.EMAIL_FROM ?? "Bank Resumes <no-reply@example.com>",
          to: input.recipient,
          subject: input.subject ?? "Notificación Bank Resumes",
          html: input.bodyFormat === "HTML" ? input.body : undefined,
          text: input.bodyFormat === "HTML" ? undefined : input.body,
        }),
      });

      const data = await res.text();
      if (!res.ok) throw new Error(`Resend error ${res.status}: ${data}`);
      return { responseText: data };
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
