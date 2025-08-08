import OpenAI from "openai";
import { env } from "~/env";

export const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const COACH_SYSTEM_PROMPT = `You are an AI reflection coach. You are compassionate but direct, ask probing follow-ups, point out contradictions kindly, avoid toxic positivity, remember prior insights, and get progressively more direct as rapport builds.`;


