import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export default async function Home() {
  const user = await currentUser();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0b0b12] to-[#15162c] text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold tracking-tight">
          30-Day AI Reflection
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/journey"
              className="rounded-full bg-[#6C63FF] px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              Go to Journey
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-16 text-center">
        <h1 className="bg-gradient-to-r from-white to-[#b3a6ff] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
          A 30-day guided journey of self-discovery
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-white/80">
          Each day presents a focused exercise in a compassionate chat with your AI coach. Insights carry forward, progress is saved, and a living rapport document grows with you.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={user ? "/journey" : "/sign-in"}
            className="rounded-full bg-[#6C63FF] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            {user ? "Continue your journey" : "Start with Google"}
          </Link>
          <a
            href="https://supabase.com" target="_blank" rel="noreferrer"
            className="rounded-full bg-white/10 px-6 py-3 text-sm font-medium hover:bg-white/20"
          >
            How it works
          </a>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold">Guided AI Coaching</h3>
          <p className="mt-2 text-sm text-white/80">Compassionate, direct, and context-aware reflections that build day by day.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold">Structured Curriculum</h3>
          <p className="mt-2 text-sm text-white/80">A proven 30-day arc covering values, goals, obstacles, systems, and integration.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold">Progress Tracking</h3>
          <p className="mt-2 text-sm text-white/80">Linear day flow with the ability to review past days anytime.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-semibold">Rapport Document</h3>
          <p className="mt-2 text-sm text-white/80">A cumulative Markdown record of your insights—export whenever you like.</p>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-center text-xs text-white/60">
        Built with Next.js, tRPC, Prisma, Clerk, Supabase, and OpenAI
      </footer>
    </main>
  );
}
