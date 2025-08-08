import { z } from "zod";
import type { Prisma } from "@prisma/client";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { COACH_SYSTEM_PROMPT } from "~/server/ai/openai";

export const journeyRouter = createTRPCRouter({
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const journey = await ctx.db.journey.findFirst({
      where: { userId: ctx.session.user.id, isActive: true },
      include: { rapport: true },
    });
    return journey;
  }),

  getCompletedDays: protectedProcedure.query(async ({ ctx }) => {
    const journey = await ctx.db.journey.findFirst({
      where: { userId: ctx.session.user.id, isActive: true },
      select: { id: true },
    });
    
    if (!journey) return [];
    
    const completedReflections = await ctx.db.reflection.findMany({
      where: { 
        journeyId: journey.id,
        completedAt: { not: null }
      },
      select: { dayNumber: true }
    });
    
    return completedReflections.map((r: { dayNumber: number }) => r.dayNumber);
  }),

  getRapport: protectedProcedure.query(async ({ ctx }) => {
    const journey = await ctx.db.journey.findFirst({
      where: { userId: ctx.session.user.id, isActive: true },
      select: { id: true },
    });
    
    if (!journey) return { content: "" };
    
    const rapport = await ctx.db.rapport.findUnique({
      where: { journeyId: journey.id },
      select: { content: true },
    });
    
    // If no rapport exists, create one
    if (!rapport) {
      await ctx.db.rapport.create({
        data: {
          journeyId: journey.id,
          content: "",
        },
      });
      return { content: "" };
    }
    
    return rapport;
  }),

  startNew: protectedProcedure
    .input(z.object({ startDay: z.number().min(1).max(30).default(1) }).optional())
    .mutation(async ({ ctx, input }) => {
      // Ensure user exists in database
      const user = await ctx.db.user.upsert({
        where: { id: ctx.session.user.id },
        update: {},
        create: {
          id: ctx.session.user.id,
          email: ctx.session.user.email || null,
          name: ctx.session.user.name || null,
        },
      });

      // Archive existing active journey if any
      await ctx.db.journey.updateMany({
        where: { userId: ctx.session.user.id, isActive: true },
        data: { isActive: false, archivedAt: new Date() },
      });

      const journey = await ctx.db.journey.create({
        data: {
          userId: ctx.session.user.id,
          currentDay: input?.startDay ?? 1,
          rapport: { create: {} },
        },
      });
      return journey;
    }),

  getDay: protectedProcedure
    .input(z.object({ day: z.number().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const journey = await ctx.db.journey.findFirst({
        where: { userId: ctx.session.user.id, isActive: true },
        select: { id: true },
      });
      
      if (!journey) {
        return null;
      }
      
      const reflection = await ctx.db.reflection.findUnique({
        where: { journeyId_dayNumber: { journeyId: journey.id, dayNumber: input.day } },
      });
      return reflection ?? null;
    }),

  saveMessageBatch: protectedProcedure
    .input(z.object({
      day: z.number().min(1).max(30),
      messages: z.array(
        z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() }),
      ),
    }))
    .mutation(async ({ ctx, input }) => {
      const journey = await ctx.db.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
        select: { id: true },
      });
      const reflection = await ctx.db.reflection.upsert({
        where: { journeyId_dayNumber: { journeyId: journey.id, dayNumber: input.day } },
        create: {
          journeyId: journey.id,
          dayNumber: input.day,
          messages: input.messages as unknown as Prisma.InputJsonValue,
        },
        update: {
          messages: input.messages as unknown as Prisma.InputJsonValue,
        },
      });
      return reflection;
    }),

  completeDay: protectedProcedure
    .input(
      z.object({
        day: z.number().min(1).max(30),
        aiSummary: z.string(),
        rapportAppend: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const journey = await ctx.db.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
        select: { id: true },
      });

      // Update reflection as completed
      await ctx.db.reflection.updateMany({
        where: { journeyId: journey.id, dayNumber: input.day },
        data: { completedAt: new Date(), aiSummary: input.aiSummary },
      });

      // Update rapport by appending content
      const existingRapport = await ctx.db.rapport.findUnique({
        where: { journeyId: journey.id },
        select: { content: true },
      });

      const newContent = existingRapport?.content 
        ? existingRapport.content + input.rapportAppend
        : input.rapportAppend;

      await ctx.db.rapport.upsert({
        where: { journeyId: journey.id },
        create: { 
          journeyId: journey.id, 
          content: newContent 
        },
        update: { 
          content: newContent 
        },
      });

      return { success: true };
    }),

  buildSystemPrompt: protectedProcedure
    .input(z.object({ day: z.number().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const journey = await ctx.db.journey.findFirst({
        where: { userId: ctx.session.user.id, isActive: true },
        include: { rapport: true },
      });

      if (!journey) {
        return "You are an AI coach helping with personal development. Start a new conversation.";
      }

      const rapportContext = journey.rapport?.content ? `\n\nPrevious Reflection Context:\n${journey.rapport.content}` : "";

      return `You are a compassionate but direct AI coach guiding someone through a 30-day personal development journey. You remember past conversations and build on previous insights.

Your role is to:
- Ask probing questions that encourage deep reflection
- Help identify patterns and insights
- Avoid toxic positivity - be real and honest
- Remember context from previous days
- Guide the user toward meaningful self-discovery

When the day is completed, you will be asked to create a structured reflection summary in this format:

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

${rapportContext}

Today is Day ${input.day} of the journey.`;
    }),
});


