import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { TOOL_DEFINITIONS, executeToolCall } from "@/lib/ai/tools";
import { checkMisuse } from "@/lib/ai/misuse-tracker";

const MAX_TOOL_ROUNDS = 5;

type Message = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI no configurada. Definí DEEPSEEK_API_KEY en el .env." }, { status: 500 });
  }

  const body = await request.json();
  const userMessages: Message[] = body.messages ?? [];
  const clientSettings: { skills?: Record<string, boolean>; model?: string; temperature?: number; adminPromptOverride?: string } = body.settings ?? {};

  // Misuse check on the latest user message
  const lastUserMsg = [...userMessages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const misuseResult = await checkMisuse(session.userId, lastUserMsg.content);
    if (!misuseResult.allowed) {
      return NextResponse.json({
        role: "assistant",
        content: misuseResult.message,
        misuse: {
          blocked: misuseResult.blocked,
          count: misuseResult.count,
          remaining: misuseResult.remaining,
          blockedUntil: misuseResult.blockedUntil,
        },
      });
    }
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = clientSettings.model ?? process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const temperature = clientSettings.temperature ?? 0.7;

  // Build system prompt dynamically based on enabled skills
  const skills = clientSettings.skills ?? {};
  let systemContent = buildSystemPrompt(skills);

  // Append admin override if provided (only admins can set this; enforced client-side but validated here)
  if (clientSettings.adminPromptOverride && session.role === "ADMIN") {
    systemContent += `\n\n## Instrucciones adicionales del administrador\n${clientSettings.adminPromptOverride}`;
  }

  const messages: Message[] = [
    { role: "system", content: systemContent },
    ...userMessages,
  ];

  let toolRounds = 0;

  while (toolRounds < MAX_TOOL_ROUNDS) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: 4096,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: "auto",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error?.message ?? "Error al comunicarse con el modelo AI" },
        { status: response.status }
      );
    }

    const choice = data.choices?.[0]?.message;
    if (!choice) {
      return NextResponse.json({ error: "El modelo no devolvió una respuesta válida" }, { status: 502 });
    }

    messages.push({
      role: "assistant",
      content: choice.content ?? "",
      tool_calls: choice.tool_calls,
    });

    if (!choice.tool_calls || choice.tool_calls.length === 0) {
      return NextResponse.json({
        role: "assistant",
        content: choice.content ?? "",
        usage: data.usage ?? null,
      });
    }

    toolRounds++;
    const toolResults = await Promise.all(
      choice.tool_calls.map((tc: any) => executeToolCall(session.userId, tc))
    );
    messages.push(...toolResults);
  }

  const last = messages.filter((m) => m.role === "assistant").pop();
  return NextResponse.json({
    role: "assistant",
    content: last?.content ?? "No se pudo completar la consulta en la cantidad de pasos permitidos.",
  });
}
