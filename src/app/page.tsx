import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";

export default async function Home() {
  const user = await currentUser();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F7F2EA] to-[#F0E8D8] text-[#3A2620]">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-lg font-semibold tracking-tight text-[#3A2620]">
          30-Day AI Reflection
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link
              href="/journey"
              className="rounded-xl bg-[#FF7A3D] px-4 py-2 text-sm font-medium text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              Go to Journey
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-xl bg-white/50 px-4 py-2 text-sm font-medium text-[#3A2620] border border-[#3A2620]/10 hover:bg-white/70 transition-all cursor-pointer"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-16 text-center">
        <h1 className="bg-gradient-to-r from-[#3A2620] to-[#FF7A3D] bg-clip-text text-5xl font-serif font-extrabold tracking-tight text-transparent sm:text-6xl">
          A 30-day guided journey of self-discovery
        </h1>
        <p className="mt-5 max-w-2xl text-balance text-lg text-[#6B534B] font-sans">
          Each day presents a focused exercise in a compassionate chat with your AI coach. Insights carry forward, progress is saved, and a living rapport document grows with you.
        </p>
        <div className="mt-8">
          <Link
            href={user ? "/journey" : "/sign-in"}
            className="rounded-xl bg-[#FF7A3D] px-8 py-4 text-lg font-semibold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            Start your Journey
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <h2 className="text-center text-3xl font-serif font-bold text-[#3A2620] mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#3A2620]/10 bg-white/60 backdrop-blur-sm p-6 shadow-lg">
            <div className="text-3xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-[#3A2620] mb-3">Guided AI Coaching</h3>
            <p className="text-sm text-[#6B534B]">Compassionate, direct, and context-aware reflections that build day by day.</p>
          </div>
          <div className="rounded-2xl border border-[#3A2620]/10 bg-white/60 backdrop-blur-sm p-6 shadow-lg">
            <div className="text-3xl mb-4">📚</div>
            <h3 className="text-lg font-semibold text-[#3A2620] mb-3">Structured Curriculum</h3>
            <p className="text-sm text-[#6B534B]">A proven 30-day arc covering values, goals, obstacles, systems, and integration.</p>
          </div>
          <div className="rounded-2xl border border-[#3A2620]/10 bg-white/60 backdrop-blur-sm p-6 shadow-lg">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-lg font-semibold text-[#3A2620] mb-3">Progress Tracking</h3>
            <p className="text-sm text-[#6B534B]">Linear day flow with the ability to review past days anytime.</p>
          </div>
          <div className="rounded-2xl border border-[#3A2620]/10 bg-white/60 backdrop-blur-sm p-6 shadow-lg">
            <div className="text-3xl mb-4">📝</div>
            <h3 className="text-lg font-semibold text-[#3A2620] mb-3">Rapport Document</h3>
            <p className="text-sm text-[#6B534B]">A cumulative Markdown record of your insights—export whenever you like.</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-center text-xs text-[#6B534B]">
        Built with Next.js, tRPC, Prisma, Clerk, Supabase, and OpenAI
      </footer>
    </main>
  );
}
