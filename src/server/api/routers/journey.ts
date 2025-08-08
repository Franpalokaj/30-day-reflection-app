import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { COACH_SYSTEM_PROMPT } from "~/server/ai/openai";

export const journeyRouter = createTRPCRouter({
  getActive: protectedProcedure.query(async ({ ctx }) => {
    const pdb = ctx.db as any;
    const journey = await pdb.journey.findFirst({
      where: { userId: ctx.session.user.id, isActive: true },
      include: { rapport: true },
    });
    return journey;
  }),

  startNew: protectedProcedure
    .input(z.object({ startDay: z.number().min(1).max(30).default(1) }).optional())
    .mutation(async ({ ctx, input }) => {
      const pdb = ctx.db as any;
      // Archive existing active journey if any
      await pdb.journey.updateMany({
        where: { userId: ctx.session.user.id, isActive: true },
        data: { isActive: false, archivedAt: new Date() },
      });

      const journey = await pdb.journey.create({
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
      const pdb = ctx.db as any;
      const journey = await pdb.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
        select: { id: true },
      });
      const reflection = await pdb.reflection.findUnique({
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
      const pdb = ctx.db as any;
      const journey = await pdb.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
        select: { id: true },
      });
      const reflection = await pdb.reflection.upsert({
        where: { journeyId_dayNumber: { journeyId: journey.id, dayNumber: input.day } },
        create: {
          journeyId: journey.id,
          dayNumber: input.day,
          messages: input.messages as unknown as Record<string, unknown>,
        },
        update: {
          messages: input.messages as unknown as Record<string, unknown>,
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
      const pdb = ctx.db as any;
      const activeJourney = await pdb.journey.findFirstOrThrow({
        where: { userId: ctx.session.user.id, isActive: true },
      });

      const reflection = await pdb.reflection.upsert({
        where: {
          journeyId_dayNumber: {
            journeyId: activeJourney.id,
            dayNumber: input.day,
          },
        },
        create: {
          journeyId: activeJourney.id,
          dayNumber: input.day,
          messages: [],
          aiSummary: input.aiSummary,
          structuredData: input.structuredData as unknown as Record<string, unknown> | null,
          completedAt: new Date(),
        },
        update: {
          aiSummary: input.aiSummary,
          structuredData: input.structuredData as unknown as Record<string, unknown> | null,
          completedAt: new Date(),
        },
      });

      const existingRapport = await pdb.rapport.findUnique({
        where: { journeyId: activeJourney.id },
        select: { content: true },
      });
      const newContent = [existingRapport?.content ?? "", "\n\n", input.rapportAppend]
        .join("")
        .trim();
      await pdb.rapport.upsert({
        where: { journeyId: activeJourney.id },
        create: { journeyId: activeJourney.id, content: newContent },
        update: { content: newContent },
      });

      const nextDay = Math.min(30, Math.max(activeJourney.currentDay, input.day) + 1);
      await pdb.journey.update({
        where: { id: activeJourney.id },
        data: { currentDay: nextDay },
      });

      return reflection;
    }),

  buildSystemPrompt: protectedProcedure
    .input(z.object({ day: z.number().min(1).max(30) }))
    .query(async ({ ctx, input }) => {
      const pdb = ctx.db as any;
      const journey = await pdb.journey.findFirst({
        where: { userId: ctx.session.user.id, isActive: true },
        include: { rapport: true, reflections: true },
      });
      const priorInsights = journey?.rapport?.content ?? "";
      const prompt = `${COACH_SYSTEM_PROMPT}\n\nToday is Day ${input.day}. Relevant prior insights (use selectively):\n${priorInsights}`;
      return { prompt };
    }),
});


