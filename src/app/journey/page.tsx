"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export default function JourneyPage() {
  const [day, setDay] = useState(1);
  const { data: system } = api.journey.buildSystemPrompt.useQuery({ day });
  const saveBatch = api.journey.saveMessageBatch.useMutation();
  const completeDay = api.journey.completeDay.useMutation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    if (system?.prompt) {
      setMessages([{ role: "system" as const, content: system.prompt }]);
    }
  }, [system?.prompt]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const nextMsgs: ChatMsg[] = [
      ...messages,
      { role: "user" as const, content: input.trim() },
    ];
    setMessages(nextMsgs);
    setInput("");
    setStreaming(true);

    // Persist optimistically
    void saveBatch.mutate({ day, messages: nextMsgs });

    const res = await fetch("/api/ai/stream", {
      method: "POST",
      body: JSON.stringify({ messages: nextMsgs }),
    });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let assistant = "";
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      assistant += decoder.decode(value, { stream: true });
      setMessages((m) => {
        const base = m.filter(
          (x, idx) => !(x.role === "assistant" && idx === m.length - 1),
        );
        return [...base, { role: "assistant" as const, content: assistant }];
      });
    }
    setStreaming(false);

    const persisted: ChatMsg[] = [
      ...nextMsgs,
      { role: "assistant" as const, content: assistant },
    ];
    void saveBatch.mutate({ day, messages: persisted });
  };

  const finish = async () => {
    // Ensure an active journey exists; if not, create one
    await api.journey.startNew.mutateAsync({ startDay: day }).catch(() => undefined);
    const transcript = messages
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
    const summary = `Day ${day} Summary:\n` + transcript.slice(0, 800);
    await completeDay.mutateAsync({
      day,
      aiSummary: summary,
      rapportAppend: `\n\n## Day ${day}\n${summary}`,
    });
    setDay((d) => Math.min(30, d + 1));
    setMessages([]);
  };

  return (
    <main className="mx-auto flex h-[100dvh] max-w-2xl flex-col gap-4 bg-gradient-to-b from-[#0b0b12] to-[#15162c] p-4 text-white">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">30-Day AI Reflection</h1>
        <div className="text-sm opacity-80">Day {day} / 30</div>
      </header>
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3"
      >
        {messages
          .filter((m) => m.role !== "system")
          .map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`${
                  m.role === "user" ? "bg-[#6C63FF]/30" : "bg-white/10"
                } rounded-2xl px-3 py-2 text-sm leading-relaxed text-white`}
              >
                {m.content}
              </div>
            </div>
          ))}
        {streaming && (
          <div className="text-sm opacity-70">AI is thinking…</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="min-h-10 flex-1 rounded-full bg-white/10 px-4 py-2 text-white outline-none placeholder:text-white/50"
          placeholder="Type your reflection…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          maxLength={1000}
        />
        <button
          onClick={send}
          disabled={streaming || !input.trim()}
          className="rounded-full bg-[#6C63FF] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Send
        </button>
        <button
          onClick={finish}
          disabled={streaming || messages.filter((m) => m.role !== "system").length < 4}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Finish Day
        </button>
      </div>
      <div className="flex justify-between text-xs opacity-70">
        <span>
          {input.length}/1000
        </span>
        <span>Progress autosaves</span>
      </div>
    </main>
  );
}


