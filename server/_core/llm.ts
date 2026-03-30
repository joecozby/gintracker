import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

const MODEL = "claude-sonnet-4-6";

function getClient(): Anthropic {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey: ENV.anthropicApiKey });
}

export type Role = "system" | "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

export type InvokeParams = {
  messages: Message[];
  maxTokens?: number;
};

export type InvokeResult = {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
};

/**
 * Invoke Claude via the Anthropic SDK.
 * Returns a response shaped like the old OpenAI-compatible result
 * so existing callers (exportImport.ts aiRouter) don't need changes.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();

  // Split out system message if present
  const systemMessages = params.messages.filter((m) => m.role === "system");
  const userMessages = params.messages.filter((m) => m.role !== "system");

  const systemPrompt =
    systemMessages.length > 0
      ? systemMessages.map((m) => m.content).join("\n")
      : undefined;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: userMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const textContent = response.content.find((c) => c.type === "text");
  const text = textContent?.type === "text" ? textContent.text : "";

  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: text,
        },
      },
    ],
  };
}
