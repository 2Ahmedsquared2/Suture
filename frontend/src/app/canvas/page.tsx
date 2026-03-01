"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import ContourGraphic from "@/components/ContourGraphic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type PipelineState =
  | "idle"
  | "preprocessing"
  | "converting_svg"
  | "reviewing_svg"
  | "converting_dst"
  | "reviewing_dst"
  | "done"
  | "error";

type ViewTab = "original" | "preprocessed" | "svg";

interface ThreadColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

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
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [dstUrl, setDstUrl] = useState<string | null>(null);
  const [dstId, setDstId] = useState<string | null>(null);
  const [threadColors, setThreadColors] = useState<ThreadColor[]>([]);
  const [stitchCount, setStitchCount] = useState(0);
  const [dimensionsMm, setDimensionsMm] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewTab>("svg");
  const [prompt, setPrompt] = useState("");
  const [svgId, setSvgId] = useState<string | null>(null);
  const [agentFeedback, setAgentFeedback] = useState<string | null>(null);
  const [svgReviewed, setSvgReviewed] = useState(false);
  const [dstReviewed, setDstReviewed] = useState(false);

  // Manufacturing quote state
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteGarment, setQuoteGarment] = useState("t-shirt");
  const [quoteQuantity, setQuoteQuantity] = useState(25);
  const [quoteResult, setQuoteResult] = useState<{
    unit_price: number;
    total_price: number;
    turnaround_days: number;
    notes: string;
  } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const runDstReview = useCallback(async (dstIdVal: string, svgIdVal: string) => {
    setPipelineState("reviewing_dst");
    setError(null);

    try {
      const res = await fetch(`${API}/review-dst`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dst_id: dstIdVal, svg_id: svgIdVal }),
        signal: AbortSignal.timeout(330000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `DST review failed (${res.status})`);
      }

      const data = await res.json();
      setDstId(data.dst_id);
      setDstUrl(`${API}${data.dst_url}`);
      setDstReviewed(data.reviewed);
      if (data.agent_feedback) setAgentFeedback(data.agent_feedback);
      setPipelineState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "DST review failed.");
      setErrorStage("review_dst");
      setPipelineState("error");
    }
  }, []);

  const runDstConversion = useCallback(async (sourceImageId: string, currentSvgId: string) => {
    setPipelineState("converting_dst");
    setError(null);

    try {
      const res = await fetch(`${API}/convert-to-dst`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_id: sourceImageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `DST conversion failed (${res.status})`);
      }

      const data = await res.json();
      setDstId(data.dst_id);
      setDstUrl(`${API}${data.dst_url}`);
      setThreadColors(data.thread_colors);
      setStitchCount(data.stitch_count);
      setDimensionsMm(data.dimensions_mm);

      await runDstReview(data.dst_id, currentSvgId);
    } catch (err) {
      if (pipelineState === "reviewing_dst") return;
      setError(err instanceof Error ? err.message : "DST conversion failed.");
      setErrorStage("dst");
      setPipelineState("error");
    }
  }, [runDstReview]);

  const runSvgReview = useCallback(async (svgIdVal: string, imageIdVal: string) => {
    setPipelineState("reviewing_svg");
    setError(null);

    try {
      const res = await fetch(`${API}/review-svg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ svg_id: svgIdVal, image_id: imageIdVal }),
        signal: AbortSignal.timeout(330000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `SVG review failed (${res.status})`);
      }

      const data = await res.json();
      setSvgId(data.svg_id);
      setSvgUrl(`${API}${data.svg_url}`);
      setSvgReviewed(data.reviewed);
      if (data.agent_feedback) setAgentFeedback(data.agent_feedback);
      setActiveTab("svg");

      await runDstConversion(imageIdVal, data.svg_id);
    } catch (err) {
      if (pipelineState === "converting_dst" || pipelineState === "reviewing_dst") return;
      setError(err instanceof Error ? err.message : "SVG review failed.");
      setErrorStage("review_svg");
      setPipelineState("error");
    }
  }, [runDstConversion]);

  const runSvgConversion = useCallback(
    async (sourceImageId: string) => {
      setPipelineState("converting_svg");
      setError(null);

      try {
        const res = await fetch(`${API}/convert-to-svg`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: sourceImageId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.detail ?? `SVG conversion failed (${res.status})`);
        }

        const data = await res.json();
        setSvgId(data.svg_id);
        setSvgUrl(`${API}${data.svg_url}`);
        setActiveTab("svg");

        await runSvgReview(data.svg_id, sourceImageId);
      } catch (err) {
        if (["reviewing_svg", "converting_dst", "reviewing_dst"].includes(pipelineState)) return;
        setError(err instanceof Error ? err.message : "SVG conversion failed.");
        setErrorStage("svg");
        setPipelineState("error");
      }
    },
    [runSvgReview]
  );

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
        throw new Error(
          data?.detail ?? `Preprocessing failed (${res.status})`
        );
      }

      const data = await res.json();
      setPreprocessedId(data.preprocessed_image_id);
      setPreprocessedUrl(`${API}${data.preprocessed_image_url}`);
      setStepsApplied(data.steps_applied);

      await runSvgConversion(data.preprocessed_image_id);
    } catch (err) {
      if (
        pipelineState === "converting_svg" ||
        pipelineState === "converting_dst"
      )
        return;
      setError(err instanceof Error ? err.message : "Preprocessing failed.");
      setErrorStage("preprocess");
      setPipelineState("error");
    }
  }, [imageId, runSvgConversion]);

  useEffect(() => {
    if (imageId && pipelineState === "idle") {
      runPreprocessing();
    }
  }, [imageId, pipelineState, runPreprocessing]);

  const handleRetry = () => {
    if (errorStage === "review_dst" && dstId && svgId) {
      runDstReview(dstId, svgId);
    } else if (errorStage === "dst" && preprocessedId && svgId) {
      runDstConversion(preprocessedId, svgId);
    } else if (errorStage === "review_svg" && svgId && preprocessedId) {
      runSvgReview(svgId, preprocessedId);
    } else if (errorStage === "svg" && preprocessedId) {
      runSvgConversion(preprocessedId);
    } else {
      setPipelineState("idle");
    }
  };

  const handleGetQuote = async () => {
    setQuoteLoading(true);
    setQuoteResult(null);
    try {
      const res = await fetch(`${API}/manufacturing-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garment: quoteGarment,
          quantity: quoteQuantity,
          stitch_count: stitchCount,
          thread_colors: threadColors.length,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuoteResult(data);
      }
    } catch {
      /* ignore for now */
    } finally {
      setQuoteLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
  };

  const tabUrl =
    activeTab === "original"
      ? imageUrl
      : activeTab === "preprocessed"
        ? preprocessedUrl
        : svgUrl;

  const isLoading =
    pipelineState === "preprocessing" ||
    pipelineState === "converting_svg" ||
    pipelineState === "reviewing_svg" ||
    pipelineState === "converting_dst" ||
    pipelineState === "reviewing_dst";

  const loadingText =
    pipelineState === "preprocessing"
      ? "Preprocessing image for embroidery..."
      : pipelineState === "converting_svg"
        ? "Converting to SVG..."
        : pipelineState === "reviewing_svg"
          ? "AI agent reviewing SVG quality..."
          : pipelineState === "converting_dst"
            ? "Generating stitch file..."
            : pipelineState === "reviewing_dst"
              ? "AI agent optimizing stitch file..."
              : "";

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background">
      <div className="grid-canvas relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42vw] max-w-[550px] opacity-20">
          <ContourGraphic width={550} height={550} lineCount={18} />
        </div>

        <div className="flex h-full items-center justify-center pt-16">
          {/* Loading states */}
          {isLoading && (
            <div className="flex flex-col items-center gap-5">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
              <p className="text-sm tracking-wide text-foreground/40">
                {loadingText}
              </p>
              {pipelineState === "preprocessing" && (
                <div className="flex flex-col items-center gap-1 text-xs text-foreground/20">
                  <span>Removing background</span>
                  <span>Normalizing resolution</span>
                  <span>Boosting contrast & sharpness</span>
                  <span>Simplifying colors</span>
                </div>
              )}
              {pipelineState === "converting_svg" && (
                <p className="text-xs text-foreground/20">
                  Tracing paths and building vector shapes...
                </p>
              )}
              {pipelineState === "reviewing_svg" && (
                <p className="text-xs text-foreground/20">
                  OpenCLAW agent checking for excess nodes, trace artifacts, stitch issues...
                </p>
              )}
              {pipelineState === "converting_dst" && (
                <p className="text-xs text-foreground/20">
                  Mapping thread colors and computing stitch paths...
                </p>
              )}
              {pipelineState === "reviewing_dst" && (
                <p className="text-xs text-foreground/20">
                  OpenCLAW agent checking stitch density, jump stitches, color order...
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {pipelineState === "error" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-sm text-red-400/90">{error}</p>
              <button
                onClick={handleRetry}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
              >
                Retry
              </button>
            </div>
          )}

          {/* Pipeline complete */}
          {pipelineState === "done" && tabUrl && (
            <div className="flex flex-col items-center gap-5 animate-in fade-in">
              {/* Image preview */}
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl shadow-black/40">
                <img
                  src={tabUrl}
                  alt={`${activeTab} view`}
                  className="max-h-[40vh] max-w-[60vw] object-contain"
                />
              </div>

              {/* View tabs */}
              <div className="flex items-center gap-1 rounded-lg bg-white/4 p-1">
                {(["original", "preprocessed", "svg"] as ViewTab[]).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-md px-3 py-1.5 text-xs capitalize transition-all ${
                        activeTab === tab
                          ? "bg-white/8 text-accent"
                          : "text-foreground/40 hover:text-foreground/60"
                      }`}
                    >
                      {tab === "svg" ? "SVG" : tab}
                    </button>
                  )
                )}
              </div>

              {/* Preprocessing badges */}
              {stepsApplied.length > 0 && activeTab === "preprocessed" && (
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

              {/* DST stats */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-4 text-xs text-foreground/40">
                  <span>{stitchCount.toLocaleString()} stitches</span>
                  <span className="text-foreground/10">|</span>
                  <span>
                    {dimensionsMm[0]} × {dimensionsMm[1]} mm
                  </span>
                  <span className="text-foreground/10">|</span>
                  <span>{threadColors.length} thread colors</span>
                </div>

                {/* Thread color swatches */}
                <div className="flex items-center gap-1.5">
                  {threadColors.map((tc, i) => (
                    <div
                      key={i}
                      title={tc.hex}
                      className="h-4 w-4 rounded-full border border-white/10"
                      style={{ backgroundColor: tc.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Agent review badges */}
              {(svgReviewed || dstReviewed) && (
                <div className="flex items-center gap-2">
                  {svgReviewed && (
                    <span className="rounded-full border border-green-500/20 bg-green-500/8 px-3 py-1 text-xs text-green-400/80">
                      SVG reviewed by AI
                    </span>
                  )}
                  {dstReviewed && (
                    <span className="rounded-full border border-green-500/20 bg-green-500/8 px-3 py-1 text-xs text-green-400/80">
                      DST optimized by AI
                    </span>
                  )}
                </div>
              )}

              {agentFeedback && (
                <p className="max-w-md text-center text-xs text-foreground/30 italic">
                  &ldquo;{agentFeedback}&rdquo;
                </p>
              )}

              {/* Download button */}
              {dstUrl && (
                <a
                  href={dstUrl}
                  download
                  className="rounded-xl bg-accent px-8 py-3 text-sm font-medium text-background transition-all hover:brightness-110"
                >
                  Download .DST File
                </a>
              )}

              {/* Manufacturing quote */}
              {dstUrl && !showQuoteForm && (
                <button
                  onClick={() => setShowQuoteForm(true)}
                  className="text-xs text-foreground/30 underline decoration-foreground/10 transition-colors hover:text-accent/60"
                >
                  Want these manufactured?
                </button>
              )}

              {showQuoteForm && (
                <div className="mt-2 flex w-full max-w-sm flex-col gap-3 rounded-xl border border-white/8 bg-white/3 p-5">
                  <p className="text-sm font-medium text-foreground/60">
                    Get a manufacturing quote
                  </p>

                  <div className="flex gap-3">
                    <select
                      value={quoteGarment}
                      onChange={(e) => setQuoteGarment(e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-foreground outline-none"
                    >
                      {["t-shirt", "hoodie", "hat", "polo", "jacket", "tote"].map(
                        (g) => (
                          <option key={g} value={g}>
                            {g.charAt(0).toUpperCase() + g.slice(1)}
                          </option>
                        )
                      )}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={quoteQuantity}
                      onChange={(e) =>
                        setQuoteQuantity(Math.max(1, parseInt(e.target.value) || 1))
                      }
                      className="w-20 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm text-foreground outline-none"
                      placeholder="Qty"
                    />
                  </div>

                  <button
                    onClick={handleGetQuote}
                    disabled={quoteLoading}
                    className="rounded-lg bg-accent/90 px-4 py-2.5 text-sm font-medium text-background transition-all hover:bg-accent disabled:opacity-50"
                  >
                    {quoteLoading ? "Getting quote..." : "Get Quote"}
                  </button>

                  {quoteResult && (
                    <div className="flex flex-col gap-2 rounded-lg border border-accent/15 bg-accent/5 p-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-foreground/50">Unit price</span>
                        <span className="text-foreground/80">
                          ${quoteResult.unit_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground/50">Total</span>
                        <span className="font-medium text-accent">
                          ${quoteResult.total_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-foreground/50">Turnaround</span>
                        <span className="text-foreground/80">
                          {quoteResult.turnaround_days} days
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-foreground/30">
                        {quoteResult.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Idle placeholder */}
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
