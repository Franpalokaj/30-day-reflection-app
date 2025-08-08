import type { NextRequest } from "next/server";
import { openai } from "~/server/ai/openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body: unknown = await req.json().catch(() => null);
  if (!body || !Array.isArray((body as { messages?: unknown }).messages)) {
    return new Response("Invalid payload", { status: 400 });
  }

  const raw = (body as { messages: Array<{ role: "system" | "user" | "assistant"; content: string }> })
    .messages;
  const messages: ChatCompletionMessageParam[] = raw.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages,
    temperature: 0.7,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}


