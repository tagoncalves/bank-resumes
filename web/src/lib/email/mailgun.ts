import FormData from "form-data";
import Mailgun from "mailgun.js";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string | null;
  apiKeyEnv?: string | null;
}

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function mailgunConfig(apiKeyEnv?: string | null) {
  const apiKeyName = apiKeyEnv?.trim() || "MAILGUN_API_KEY";
  const apiKey = env(apiKeyName) ?? env("MAILGUN_API_KEY");
  const domain = env("MAILGUN_DOMAIN");
  const url = env("MAILGUN_API_URL") ?? "https://api.mailgun.net";

  if (!apiKey) throw new Error(`Falta configurar ${apiKeyName} para enviar por Mailgun`);
  if (!domain) throw new Error("Falta configurar MAILGUN_DOMAIN para enviar por Mailgun");
  if (domain.startsWith("sandbox")) {
    throw new Error("MAILGUN_DOMAIN apunta a un dominio sandbox. Configurá un dominio productivo verificado en Mailgun.");
  }

  return { apiKey, domain, url };
}

function safeString(value: unknown) {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function mailgunErrorMessage(error: unknown) {
  const parts = ["Mailgun no pudo enviar el email"];

  if (error instanceof Error && error.message) parts.push(error.message);

  if (error && typeof error === "object") {
    const data = error as Record<string, unknown>;
    const status = data.status ?? data.statusCode;
    const details = data.details ?? data.response ?? data.body;

    if (status) parts.push(`status ${status}`);
    const detailText = safeString(details);
    if (detailText && detailText !== (error instanceof Error ? error.message : undefined)) {
      parts.push(detailText);
    }
  }

  return parts.join(": ");
}

export async function sendEmail(input: SendEmailInput) {
  const { apiKey, domain, url } = mailgunConfig(input.apiKeyEnv);
  const from = input.from ?? env("EMAIL_FROM") ?? "Bank Resumes <no-reply@example.com>";
  const mailgun = new Mailgun(FormData);
  const client = mailgun.client({ username: "api", key: apiKey, url });
  const message = input.html
    ? {
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }
    : {
        from,
        to: input.to,
        subject: input.subject,
        text: input.text ?? "",
      };

  let result: { id?: string; message?: string };
  try {
    result = await client.messages.create(domain, message);
  } catch (error) {
    throw new Error(mailgunErrorMessage(error));
  }

  return {
    providerMessageId: result.id,
    responseText: result.message,
  };
}
