"use client";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] p-6">
      <SignIn routing="path" path="/sign-in" />
    </main>
  );
}


