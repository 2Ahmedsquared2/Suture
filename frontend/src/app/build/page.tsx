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
    <div className="relative flex min-h-screen flex-col items-center justify-end overflow-hidden bg-background">
      {/* Contour background — fills upper area */}
      <div className="absolute inset-0 flex items-start justify-center">
        <ContourGraphic
          className="w-[80vw] max-w-[1000px] mt-[-5vh] opacity-70"
          width={1000}
          height={900}
          lineCount={30}
          variant="background"
        />
      </div>

      {/* Input area */}
      <div className="relative z-10 w-full max-w-2xl px-8 pb-[12vh]">
        <label className="mb-3 block text-sm font-medium tracking-wide text-accent">
          Let&apos;s Build ...
        </label>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to embroider..."
            className="w-full rounded-lg border border-border bg-foreground/90 px-5 py-4 text-base text-background placeholder:text-background/40 outline-none focus:border-accent/40 transition-colors"
          />
        </form>
      </div>
    </div>
  );
}
