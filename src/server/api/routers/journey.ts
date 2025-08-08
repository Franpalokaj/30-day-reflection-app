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

  startNew: protectedProcedure
    .input(z.object({ startDay: z.number().min(1).max(30).default(1) }).optional())
    .mutation(async ({ ctx, input }) => {
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
      const journey = await ctx.db.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
        select: { id: true },
      });
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
        aiSummary: z.string().min(1),
        rapportAppend: z.string().min(1),
        structuredData: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const activeJourney = await ctx.db.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
      });

      const reflection = await ctx.db.reflection.upsert({
        where: {
          journeyId_dayNumber: {
            journeyId: activeJourney.id,
            dayNumber: input.day,
          },
        },
        create: {
          journeyId: activeJourney.id,
          dayNumber: input.day,
          messages: [] as unknown as Prisma.InputJsonValue,
          aiSummary: input.aiSummary,
          structuredData: (input.structuredData ?? null) as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
        update: {
          aiSummary: input.aiSummary,
          structuredData: (input.structuredData ?? null) as unknown as Prisma.InputJsonValue,
          completedAt: new Date(),
        },
      });

      const existingRapport = await ctx.db.rapport.findUnique({
        where: { journeyId: activeJourney.id },
        select: { content: true },
      });
      const newContent = [existingRapport?.content ?? "", "\n\n", input.rapportAppend]
        .join("")
        .trim();
      await ctx.db.rapport.upsert({
        where: { journeyId: activeJourney.id },
        create: { journeyId: activeJourney.id, content: newContent },
        update: { content: newContent },
      });

      const nextDay = Math.min(30, Math.max(activeJourney.currentDay, input.day) + 1);
      await ctx.db.journey.update({
        where: { id: activeJourney.id },
        data: { currentDay: nextDay },
      });

      return reflection;
    }),

  buildSystemPrompt: protectedProcedure
    .input(z.object({ day: z.number().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const journey = await ctx.db.journey.findFirst({
        where: { userId: ctx.session.user.id, isActive: true },
        include: { rapport: true, reflections: true },
      });
      const priorInsights = journey?.rapport?.content ?? "";
      const prompt = `${COACH_SYSTEM_PROMPT}\n\nToday is Day ${input.day}. Relevant prior insights (use selectively):\n${priorInsights}`;
      return { prompt };
    }),
});


