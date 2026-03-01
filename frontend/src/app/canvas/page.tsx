"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ContourGraphic from "@/components/ContourGraphic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PipelineState = "idle" | "preprocessing" | "preprocessed" | "error";

const STEP_LABELS: Record<string, string> = {
  background_removed: "Background removed",
  normalized_resolution: "Resolution normalized",
  contrast_sharpness_boosted: "Contrast & sharpness boosted",
  colors_simplified: "Colors simplified for stitching",
};

function CanvasContent() {
  const searchParams = useSearchParams();
  const imageId = searchParams.get("imageId");
  const imageUrl = searchParams.get("imageUrl") ?? null;

  const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
  const [preprocessedUrl, setPreprocessedUrl] = useState<string | null>(null);
  const [preprocessedId, setPreprocessedId] = useState<string | null>(null);
  const [stepsApplied, setStepsApplied] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [prompt, setPrompt] = useState("");

  const runPreprocessing = useCallback(async () => {
    if (!imageId) return;
    setPipelineState("preprocessing");
    setError(null);

    try {
      const res = await fetch(`${API}/preprocess-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: imageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Preprocessing failed (${res.status})`);
      }

      const data = await res.json();
      setPreprocessedId(data.preprocessed_image_id);
      setPreprocessedUrl(`${API}${data.preprocessed_image_url}`);
      setStepsApplied(data.steps_applied);
      setPipelineState("preprocessed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preprocessing failed.");
      setPipelineState("error");
    }
  }, [imageId]);

  useEffect(() => {
    if (imageId && pipelineState === "idle") {
      runPreprocessing();
    }
  }, [imageId, pipelineState, runPreprocessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    // TODO: trigger next pipeline step
  };

  const displayUrl =
    pipelineState === "preprocessed" && preprocessedUrl && !showOriginal
      ? preprocessedUrl
      : imageUrl;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      {/* Grid workspace area */}
      <div className="grid-canvas relative flex-1 overflow-hidden">
        {/* Contour accent */}
        <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42vw] max-w-[550px] opacity-20">
          <ContourGraphic width={550} height={550} lineCount={18} />
        </div>

        {/* Canvas center */}
        <div className="flex h-full items-center justify-center pt-16">
          {/* Preprocessing spinner */}
          {pipelineState === "preprocessing" && (
            <div className="flex flex-col items-center gap-5">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
              <p className="text-sm tracking-wide text-foreground/40">
                Preprocessing image for embroidery...
              </p>
              <div className="flex flex-col items-center gap-1 text-xs text-foreground/20">
                <span>Removing background</span>
                <span>Normalizing resolution</span>
                <span>Boosting contrast & sharpness</span>
                <span>Simplifying colors</span>
              </div>
            </div>
          )}

          {/* Error */}
          {pipelineState === "error" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-red-400/90">{error}</p>
              <button
                onClick={runPreprocessing}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
              >
                Retry
              </button>
            </div>
          )}

          {/* Preprocessed result */}
          {pipelineState === "preprocessed" && displayUrl && (
            <div className="flex flex-col items-center gap-5 animate-in fade-in">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl shadow-black/40">
                <img
                  src={displayUrl}
                  alt={showOriginal ? "Original image" : "Preprocessed image"}
                  className="max-h-[50vh] max-w-[65vw] object-contain"
                />
              </div>

              {/* Toggle original / preprocessed */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOriginal(false)}
                  className={`rounded-md px-3 py-1.5 text-xs transition-all ${
                    !showOriginal
                      ? "bg-white/8 text-accent"
                      : "text-foreground/40 hover:text-foreground/60"
                  }`}
                >
                  Preprocessed
                </button>
                <button
                  onClick={() => setShowOriginal(true)}
                  className={`rounded-md px-3 py-1.5 text-xs transition-all ${
                    showOriginal
                      ? "bg-white/8 text-accent"
                      : "text-foreground/40 hover:text-foreground/60"
                  }`}
                >
                  Original
                </button>
              </div>

              {/* Steps applied */}
              {stepsApplied.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {stepsApplied.map((step) => (
                    <span
                      key={step}
                      className="rounded-full border border-accent/20 bg-accent/8 px-3 py-1 text-xs text-accent/80"
                    >
                      {STEP_LABELS[step] ?? step}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-xs tracking-widest text-foreground/30">
                Image preprocessed — ready for SVG conversion
              </p>
            </div>
          )}

          {/* Idle with no image */}
          {pipelineState === "idle" && !imageId && (
            <p className="text-sm tracking-widest text-foreground/20">
              Your preview will appear here
            </p>
          )}
        </div>
      </div>

      {/* Bottom input bar */}
      <div className="relative z-10 border-t border-white/6 bg-background px-8 pb-8 pt-5">
        <p className="mb-3 text-sm font-medium tracking-widest text-accent">
          Let&apos;s Build ...
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to embroider..."
            className="w-full rounded-xl border border-white/10 bg-white/[0.07] px-5 py-4 text-base text-foreground outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/10"
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
