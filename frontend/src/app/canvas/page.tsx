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
        {/* Contour accent — bottom right corner */}
        <div className="pointer-events-none absolute -bottom-32 -right-24 w-[45vw] max-w-[600px] opacity-25">
          <ContourGraphic
            width={600}
            height={600}
            lineCount={20}
            variant="background"
          />
        </div>

        {/* Canvas center — future SVG/DST preview area */}
        <div className="flex h-full items-center justify-center">
          <p className="text-sm tracking-wide text-muted">
            Your preview will appear here
          </p>
        </div>
      </div>

      {/* Bottom input bar */}
      <div className="relative z-10 border-t border-border bg-background/80 px-8 pb-8 pt-5 backdrop-blur-sm">
        <label className="mb-3 block text-sm font-medium tracking-wide text-accent">
          Let&apos;s Build ...
        </label>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to embroider..."
            className="w-full rounded-lg border border-border bg-foreground/90 px-5 py-4 text-base text-background outline-none transition-colors placeholder:text-background/40 focus:border-accent/40"
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
