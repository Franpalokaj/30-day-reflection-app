"use client";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] p-6">
      <SignUp routing="path" path="/sign-up" />
    </main>
  );
}


