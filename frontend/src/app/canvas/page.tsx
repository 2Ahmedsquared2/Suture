"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ContourGraphic from "@/components/ContourGraphic";

function CanvasContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const [prompt, setPrompt] = useState(initialPrompt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    // TODO: trigger pipeline with prompt
  };

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Grid workspace area */}
      <div className="grid-canvas relative flex-1 overflow-hidden">
        {/* Contour accent — bottom right corner, decorative */}
        <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42vw] max-w-[550px] opacity-20">
          <ContourGraphic width={550} height={550} lineCount={18} />
        </div>

        {/* Canvas center — future SVG/DST preview */}
        <div className="flex h-full items-center justify-center pt-16">
          <p className="text-sm tracking-widest text-foreground/20">
            Your preview will appear here
          </p>
        </div>
      </div>

      {/* Bottom input bar */}
      <div className="relative z-10 border-t border-white/[0.06] bg-background px-8 pb-8 pt-5">
        <p className="mb-3 text-sm font-medium tracking-widest text-accent">
          Let&apos;s Build ...
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to embroider..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.07] px-5 py-4 text-base text-foreground outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/[0.1]"
          />
        </form>
      </div>
    </div>
  );
}

export default function CanvasPage() {
  return (
    <Suspense>
      <CanvasContent />
    </Suspense>
  );
}
