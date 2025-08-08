"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "~/trpc/react";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export default function JourneyPage() {
  const [day, setDay] = useState(1);
  const [showRapport, setShowRapport] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isDayCompleted, setIsDayCompleted] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const hasInitialized = useRef(false);
  const { data: activeJourney, refetch: refetchJourney } = api.journey.getActive.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const { data: system } = api.journey.buildSystemPrompt.useQuery({ day }, {
    enabled: !!activeJourney && day > 0 && day <= 30 && !isInitializing,
    retry: false,
  });
  const { data: currentDayData } = api.journey.getDay.useQuery({ day }, {
    enabled: !!activeJourney && day > 0 && day <= 30 && !isInitializing,
    retry: false,
  });
  const { data: completedDays = [] } = api.journey.getCompletedDays.useQuery(undefined, {
    enabled: !!activeJourney,
    retry: false,
  });
  const { data: rapportData } = api.journey.getRapport.useQuery(undefined, {
    enabled: !!activeJourney,
    retry: false,
  });
  const saveBatch = api.journey.saveMessageBatch.useMutation();
  const completeDay = api.journey.completeDay.useMutation();
  const startNewJourney = api.journey.startNew.useMutation();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load existing messages for the current day
  useEffect(() => {
    if (currentDayData?.messages) {
      const loadedMessages = currentDayData.messages as ChatMsg[];
      setMessages(loadedMessages);
      // Check if this day is completed
      setIsDayCompleted(!!currentDayData.completedAt);
    } else if (system) {
      setMessages([{ role: "system" as const, content: system }]);
      setIsDayCompleted(false);
    }
  }, [currentDayData, system]);

  // Proactively start the conversation when system message is loaded
  useEffect(() => {
    if (system && messages.length === 1 && messages[0]?.role === "system" && !isDayCompleted && !streaming) {
      // Send initial AI message to start the conversation
      const startConversation = async () => {
        const initialMessages: ChatMsg[] = [
          { role: "system" as const, content: system },
          { role: "user" as const, content: "Hello! I'm ready to start my reflection for day " + day + "." }
        ];
        
        setMessages(initialMessages);
        setStreaming(true);

        // Persist optimistically
        void saveBatch.mutate({ day, messages: initialMessages });

        const res = await fetch("/api/ai/stream", {
          method: "POST",
          body: JSON.stringify({ messages: initialMessages }),
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
          ...initialMessages,
          { role: "assistant" as const, content: assistant },
        ];
        void saveBatch.mutate({ day, messages: persisted });
      };

      void startConversation();
    }
  }, [system, messages, day, isDayCompleted, saveBatch, streaming]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, streaming]);



  const send = async () => {
    if (!input.trim() || streaming || isDayCompleted) return;
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
    try {
      console.log("Finishing day", day);

      // Prevent double completion
      if (isDayCompleted) {
        console.log("Day already completed, skipping");
        return;
      }

      // Ensure an active journey exists; if not, create one
      if (!activeJourney) {
        console.log("No active journey, creating one...");
        await startNewJourney.mutateAsync({ startDay: day });
        await refetchJourney();
      }

      // Save current messages first
      const currentMessages = messages.filter((m) => m.role !== "system");
      if (currentMessages.length > 0) {
        await saveBatch.mutateAsync({ day, messages: messages });
      }

      // Create a summary from the conversation (excluding system messages)
      const conversationMessages = messages.filter((m) => m.role !== "system");
      const transcript = conversationMessages
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n\n");

      // Generate a structured reflection summary using AI
      console.log("Generating AI summary for day", day);
      const summaryResponse = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are an AI coach analyzing a day's conversation. Create a structured reflection summary in this exact format:

Day X:
Key points we talked about:
• [Main topics discussed]
• [Important questions raised]

Core insights:
• [Key realizations or discoveries]
• [Important patterns identified]

Recurring patterns:
• [Any themes that emerged]
• [Connections to previous days]

Be concise but insightful. Focus on the most meaningful parts of the conversation.`
            },
            {
              role: "user",
              content: `Please analyze this conversation and create a structured reflection summary for Day ${day}:\n\n${transcript}`
            }
          ]
        })
      });

      console.log("AI summary response status:", summaryResponse.status);
      if (!summaryResponse.ok) {
        throw new Error("Failed to generate summary");
      }

      // Read the streaming response as text
      const reader = summaryResponse.body?.getReader();
      const decoder = new TextDecoder();
      let structuredSummary = "";
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          structuredSummary += decoder.decode(value, { stream: true });
        }
      }

      // Fallback if no summary was generated
      if (!structuredSummary.trim()) {
        structuredSummary = `Day ${day} Summary:\n${transcript.slice(0, 500)}${transcript.length > 500 ? '...' : ''}`;
      }

      console.log("Final structured summary:", structuredSummary);
      console.log("About to call completeDay mutation");

      await completeDay.mutateAsync({
        day,
        aiSummary: structuredSummary,
        rapportAppend: `\n\n## Day ${day}\n${structuredSummary}`,
      });

      console.log("Day completed successfully");
      setIsDayCompleted(true);
      setShowSuccessAnimation(true);
      setInput(""); // Clear input

      // Refetch rapport data to update the reflection document
      console.log("Refetching journey data...");
      await refetchJourney();
      console.log("Journey data refetched");

      // Hide success animation after 3 seconds
      setTimeout(() => {
          setShowSuccessAnimation(false);
      }, 3000);

      // Move to next day after a longer delay to prevent double completion
      setTimeout(() => {
          const nextDay = Math.min(30, day + 1);
          console.log("Moving to next day:", nextDay);
          setDay(nextDay);
          setMessages([]);
          setIsDayCompleted(false);
      }, 4000); // Increased delay to prevent conflicts

    } catch (error) {
      console.error("Error finishing day:", error);
    }
  };

  const handleDayClick = (newDay: number) => {
    if (newDay !== day) {
      setDay(newDay);
      setMessages([]);
      setIsDayCompleted(false);
    }
  };

  const isDayCompletedInProgress = (dayNum: number) => {
    return completedDays.includes(dayNum);
  };

  // Auto-start journey if none exists
  useEffect(() => {
    if (!activeJourney && !hasInitialized.current && !isInitializing) {
      hasInitialized.current = true;
      setIsInitializing(true);
      setDay(1); // Ensure day is set to 1
      
      // Add timeout fallback
      const timeoutId = setTimeout(() => {
        console.log("Timeout reached, forcing initialization to false");
        setIsInitializing(false);
      }, 10000); // 10 second timeout
      
      startNewJourney.mutate({ startDay: 1 }, {
        onSuccess: async () => {
          console.log("Journey created successfully, refetching...");
          clearTimeout(timeoutId);
          await refetchJourney();
          setIsInitializing(false);
        },
        onError: (error) => {
          console.error("Failed to create journey:", error);
          clearTimeout(timeoutId);
          setIsInitializing(false);
        }
      });
    }
  }, [activeJourney, hasInitialized, isInitializing, startNewJourney, refetchJourney]);

  // Show loading screen while initializing
  if (!activeJourney || isInitializing) {
    console.log("Loading screen: activeJourney:", !!activeJourney, "isInitializing:", isInitializing);
    return (
      <div className="flex h-[100dvh] bg-gradient-to-b from-[#F7F2EA] to-[#F0E8D8] text-[#3A2620] items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🌟</div>
          <h1 className="text-2xl font-bold mb-2 text-[#3A2620] font-serif">Starting your journey...</h1>
          <p className="text-sm opacity-80 text-[#6B534B] font-sans">Preparing your personalized reflection space</p>
          {isInitializing && (
            <button
              onClick={() => {
                console.log("Manual refresh clicked");
                setIsInitializing(false);
                hasInitialized.current = false;
                refetchJourney();
              }}
              className="mt-4 rounded-xl bg-[#FF7A3D] px-4 py-2 text-sm text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Continue to Journey
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gradient-to-b from-[#F7F2EA] to-[#F0E8D8] text-[#3A2620] overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#3A2620]/10 bg-white/60 backdrop-blur-sm p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2 text-[#3A2620]">Your Journey</h2>
          <div className="text-sm opacity-80 text-[#6B534B]">
            Day {activeJourney?.currentDay ?? 1} of 30
          </div>
        </div>
        
        {/* Day Navigation */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3 text-[#3A2620]">Progress</h3>
          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((dayNum) => (
              <button
                key={dayNum}
                onClick={() => handleDayClick(dayNum)}
                className={`p-2 text-xs rounded-lg cursor-pointer transition-colors ${
                  dayNum === day
                    ? "bg-[#FF7A3D] text-white shadow-md"
                    : isDayCompletedInProgress(dayNum)
                    ? "bg-[#68C59B]/20 text-[#68C59B] hover:bg-[#68C59B]/30"
                    : "bg-white/50 text-[#6B534B] hover:bg-white/70 border border-[#3A2620]/10"
                }`}
              >
                {dayNum}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => setShowRapport(!showRapport)}
            className="w-full rounded-xl bg-white/50 px-3 py-2 text-sm hover:bg-white/70 cursor-pointer transition-colors border border-[#3A2620]/10 text-[#3A2620]"
          >
            {showRapport ? "Hide" : "View"} Reflection Document
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-[#F7F2EA] to-[#F0E8D8]">
        <header className="flex items-center justify-between p-6 border-b border-[#3A2620]/10 bg-white/40 backdrop-blur-sm">
          <h1 className="text-2xl font-semibold text-[#3A2620] font-serif">Day {day} / 30</h1>
          <div className="text-sm opacity-80 text-[#6B534B]">
            {activeJourney ? `Journey started ${new Date(activeJourney.startedAt).toLocaleDateString()}` : "No active journey"}
          </div>
        </header>

        {showRapport ? (
          /* Reflection Document View */
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6 text-[#3A2620] font-serif">Your Reflection Document</h2>
              <div className="bg-white/70 rounded-2xl p-8 border border-[#3A2620]/10 shadow-lg">
                <div className="prose prose-[#3A2620] max-w-none prose-lg">
                  <div className="font-sans text-base leading-relaxed">
                    {rapportData?.content ? (
                      rapportData.content.split('\n').map((line: string, index: number) => {
                        // Handle markdown headers
                        if (line.startsWith('# ')) {
                          return <h1 key={index} className="text-2xl font-bold mb-3 mt-4 first:mt-0">{line.substring(2)}</h1>;
                        }
                        if (line.startsWith('## ')) {
                          return <h2 key={index} className="text-xl font-semibold mb-2 mt-3">{line.substring(3)}</h2>;
                        }
                        if (line.startsWith('### ')) {
                          return <h3 key={index} className="text-lg font-medium mb-2 mt-2">{line.substring(4)}</h3>;
                        }
                        // Handle bullet points
                        if (line.startsWith('• ') || line.startsWith('- ')) {
                          return <li key={index} className="ml-4 mb-1">{line.substring(2)}</li>;
                        }
                        // Handle numbered lists
                        if (/^\d+\.\s/.test(line)) {
                          return <li key={index} className="ml-4 mb-1">{line.replace(/^\d+\.\s/, '')}</li>;
                        }
                                                // Handle bold text
                        if (line.includes('**')) {
                          const parts = line.split('**');
                          // Only process if we have at least 3 parts (meaning at least one complete pair)
                          if (parts.length >= 3) {
                            return (
                              <p key={index} className="mb-2">
                                {parts.map((part: string, i: number) => i % 2 === 0 ? part : <strong key={i}>{part}</strong>)}
                              </p>
                            );
                          }
                        }
                        // Regular paragraph
                        return <p key={index} className="mb-2">{line}</p>;
                      })
                    ) : (
                      <p className="text-[#6B534B] italic">No reflections yet. Complete some days to build your document.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Interface */
          <div className="flex-1 flex flex-col p-6 h-full">
            <div
              ref={listRef}
              className="flex-1 space-y-6 overflow-y-auto rounded-2xl border border-[#3A2620]/10 bg-white/60 backdrop-blur-sm p-6 mb-6 shadow-lg min-h-0 max-h-full"
            >
              {messages
                .filter((m) => m.role !== "system")
                .map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`${
                        m.role === "user" 
                          ? "bg-[#FF7A3D]/10 text-[#3A2620] rounded-2xl px-4 py-3 max-w-[70%] shadow-sm border border-[#FF7A3D]/20" 
                          : "bg-transparent text-[#3A2620] w-full max-w-4xl mx-auto"
                      } text-sm leading-relaxed`}
                    >
                      {m.role === "assistant" ? (
                        <div className="prose prose-[#3A2620] max-w-none prose-lg">
                          <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">
                            {m.content.split('\n').map((line: string, index: number) => {
                              // Handle markdown headers
                              if (line.startsWith('# ')) {
                                return <h1 key={index} className="text-2xl font-bold mb-3 mt-4 first:mt-0">{line.substring(2)}</h1>;
                              }
                              if (line.startsWith('## ')) {
                                return <h2 key={index} className="text-xl font-semibold mb-2 mt-3">{line.substring(3)}</h2>;
                              }
                              if (line.startsWith('### ')) {
                                return <h3 key={index} className="text-lg font-medium mb-2 mt-2">{line.substring(4)}</h3>;
                              }
                              // Handle bullet points
                              if (line.startsWith('• ') || line.startsWith('- ')) {
                                return <li key={index} className="ml-4 mb-1">{line.substring(2)}</li>;
                              }
                              // Handle numbered lists
                              if (/^\d+\.\s/.test(line)) {
                                return <li key={index} className="ml-4 mb-1">{line.replace(/^\d+\.\s/, '')}</li>;
                              }
                              // Handle bold text
                              if (line.includes('**')) {
                                const parts = line.split('**');
                                // Only process if we have at least 3 parts (meaning at least one complete pair)
                                if (parts.length >= 3) {
                                  return (
                                    <p key={index} className="mb-2">
                                      {parts.map((part: string, i: number) => i % 2 === 0 ? part : <strong key={i}>{part}</strong>)}
                                    </p>
                                  );
                                }
                              }
                              // Regular paragraph
                              return <p key={index} className="mb-2">{line}</p>;
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))}
              {streaming && (
                <div className="flex justify-start">
                  <div className="bg-transparent text-[#3A2620] w-full max-w-4xl mx-auto">
                    <div className="text-sm opacity-70 font-sans">AI is thinking…</div>
                  </div>
                </div>
              )}
              {isDayCompleted && (
                <div className="text-center py-4">
                  <div className="bg-[#68C59B]/20 text-[#68C59B] rounded-xl p-4 max-w-md mx-auto border border-[#68C59B]/30">
                    <div className="text-sm font-medium font-sans">✅ Day {day} Completed!</div>
                    <div className="text-xs opacity-80">Moving to next day...</div>
                  </div>
                </div>
              )}
              {showSuccessAnimation && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 animate-pulse">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🎉</div>
                      <div className="text-xl font-bold text-white mb-2">Day {day} Completed!</div>
                      <div className="text-sm opacity-80">Your reflection has been saved and added to your document.</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-end gap-3 max-w-4xl mx-auto w-full flex-shrink-0 mt-auto pb-6">
              <textarea
                ref={textareaRef}
                className="flex-1 rounded-2xl bg-white/70 px-4 py-3 text-[#3A2620] outline-none placeholder:text-[#6B534B] disabled:opacity-50 resize-none border border-[#3A2620]/20 focus:border-[#FF7A3D]/50 focus:ring-2 focus:ring-[#FF7A3D]/20 transition-all shadow-sm"
                placeholder={isDayCompleted ? "Day completed - moving to next day..." : "Type your reflection…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isDayCompleted) {
                    e.preventDefault();
                    void send();
                  }
                }}
                maxLength={10000}
                disabled={isDayCompleted}
                rows={1}
                style={{ height: '48px', minHeight: '48px', maxHeight: '48px', lineHeight: '1.2' }}
              />
              <button
                onClick={send}
                disabled={streaming || !input.trim() || isDayCompleted}
                className="rounded-xl bg-[#FF7A3D] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 cursor-pointer hover:bg-[#FF7A3D]/90 transition-colors flex-shrink-0 shadow-md hover:shadow-lg"
              >
                Send
              </button>
              <button
                onClick={finish}
                disabled={streaming || messages.filter((m) => m.role !== "system").length < 4 || isDayCompleted}
                className="rounded-xl bg-[#68C59B] px-4 py-3 text-sm font-medium text-white disabled:opacity-50 cursor-pointer hover:bg-[#68C59B]/90 transition-colors flex-shrink-0 shadow-md hover:shadow-lg"
              >
                {isDayCompleted ? "Completed" : "Finish Day"}
              </button>
            </div>
            
            <div className="flex justify-between text-xs opacity-70 mt-2 max-w-4xl mx-auto w-full text-[#6B534B] font-sans pb-4">
              <span>{input.length}/10000</span>
              <span>Progress autosaves</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


