"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ContourGraphic from "@/components/ContourGraphic";

export default function BuildPage() {
  const [prompt, setPrompt] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    router.push(`/canvas?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  return (
    <div className="relative flex h-screen flex-col items-center justify-end overflow-hidden bg-background">
      {/* Massive contour background — fills entire viewport, bleeds past edges */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ContourGraphic
          className="h-[160vh] w-auto min-w-[160vw] opacity-60"
          width={1200}
          height={1200}
          lineCount={34}
        />
      </div>

      {/* Input area — bottom center, wide */}
      <div className="relative z-10 mx-auto w-full max-w-4xl px-8 pb-16">
        <p className="mb-3 text-sm font-medium tracking-widest text-accent">
          Let&apos;s Build ...
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to embroider..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.07] px-6 py-4 text-base text-foreground backdrop-blur-md outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/[0.1]"
          />
        </form>
      </div>
    </div>
  );
}
