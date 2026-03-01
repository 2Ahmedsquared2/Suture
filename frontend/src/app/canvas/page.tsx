"use client";

import { useState, useEffect, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ContourGraphic from "@/components/ContourGraphic";
import GarmentMockup from "@/components/GarmentMockup";
import { useAuth } from "@/context/AuthContext";
import AuthGuard from "@/components/AuthGuard";

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

interface ThreadColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

function CanvasContent() {
  const searchParams = useSearchParams();
  const { token } = useAuth();
  const imageId = searchParams.get("imageId");
  const imageUrl = searchParams.get("imageUrl") ?? null;
  const promptParam = searchParams.get("prompt") ?? null;
  const savedRef = useRef(false);
  const pipelineStartedRef = useRef(false);

  const [pipelineState, setPipelineState] = useState<PipelineState>("idle");
  const [preprocessedUrl, setPreprocessedUrl] = useState<string | null>(null);
  const [preprocessedId, setPreprocessedId] = useState<string | null>(null);
  const [svgUrl, setSvgUrl] = useState<string | null>(null);
  const [dstUrl, setDstUrl] = useState<string | null>(null);
  const [dstId, setDstId] = useState<string | null>(null);
  const [threadColors, setThreadColors] = useState<ThreadColor[]>([]);
  const [stitchCount, setStitchCount] = useState(0);
  const [dimensionsMm, setDimensionsMm] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<string | null>(null);
  const [svgId, setSvgId] = useState<string | null>(null);
  const [agentFeedback, setAgentFeedback] = useState<string | null>(null);
  const [svgReviewed, setSvgReviewed] = useState(false);
  const [dstReviewed, setDstReviewed] = useState(false);

  // DST stitch preview
  const [showDstPreview, setShowDstPreview] = useState(false);
  const [dstPreviewUrl, setDstPreviewUrl] = useState<string | null>(null);
  const [dstPreviewLoading, setDstPreviewLoading] = useState(false);

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
    if (imageId && pipelineState === "idle" && !pipelineStartedRef.current) {
      pipelineStartedRef.current = true;
      runPreprocessing();
    }
  }, [imageId, pipelineState, runPreprocessing]);

  useEffect(() => {
    if (pipelineState !== "done" || savedRef.current || !token) return;
    savedRef.current = true;

    fetch(`${API}/sutures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        prompt: promptParam,
        original_image_url: imageUrl ? imageUrl : null,
        preprocessed_image_url: preprocessedUrl,
        svg_url: svgUrl,
        dst_url: dstUrl,
        dst_id: dstId,
        stitch_count: stitchCount,
        dimensions_mm: dimensionsMm.length ? dimensionsMm : null,
        thread_colors: threadColors,
        svg_reviewed: svgReviewed,
        dst_reviewed: dstReviewed,
        agent_feedback: agentFeedback,
      }),
    }).catch(() => {});
  }, [
    pipelineState, token, promptParam, imageUrl, preprocessedUrl,
    svgUrl, dstUrl, dstId, stitchCount, dimensionsMm,
    threadColors, svgReviewed, dstReviewed, agentFeedback,
  ]);

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

  const handleToggleDstPreview = async () => {
    if (showDstPreview) {
      setShowDstPreview(false);
      return;
    }
    setShowDstPreview(true);

    if (!dstPreviewUrl && preprocessedId) {
      setDstPreviewLoading(true);
      try {
        const res = await fetch(`${API}/dst-preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: preprocessedId }),
        });
        if (res.ok) {
          const data = await res.json();
          setDstPreviewUrl(`${API}${data.preview_url}`);
          if (data.thread_colors) setThreadColors(data.thread_colors);
          if (data.stitch_count) setStitchCount(data.stitch_count);
          if (data.dimensions_mm) setDimensionsMm(data.dimensions_mm);
        }
      } catch {
        /* preview is non-critical */
      } finally {
        setDstPreviewLoading(false);
      }
    }
  };

  const designUrl = preprocessedUrl || imageUrl || null;

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
      <div className="grid-canvas relative flex-1 overflow-y-auto">
        <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42vw] max-w-[550px] opacity-20">
          <ContourGraphic width={550} height={550} lineCount={18} />
        </div>

        <div className="flex min-h-full flex-col items-center justify-center px-4 pt-20 pb-10">
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
                  OpenCLAW agent checking for excess nodes, trace artifacts,
                  stitch issues...
                </p>
              )}
              {pipelineState === "converting_dst" && (
                <p className="text-xs text-foreground/20">
                  Mapping thread colors and computing stitch paths...
                </p>
              )}
              {pipelineState === "reviewing_dst" && (
                <p className="text-xs text-foreground/20">
                  OpenCLAW agent checking stitch density, jump stitches, color
                  order...
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

          {/* Pipeline complete — Garment Mockup + DST Preview */}
          {pipelineState === "done" && designUrl && (
            <div className="flex w-full max-w-2xl flex-col items-center gap-6 animate-in fade-in">
              <GarmentMockup designImageUrl={designUrl} />

              {/* Review badges */}
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
                <p className="max-w-md text-center text-xs italic text-foreground/30">
                  &ldquo;{agentFeedback}&rdquo;
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleDstPreview}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
                >
                  {showDstPreview
                    ? "Hide Stitch Map"
                    : "Preview DST Stitch Map"}
                </button>
                {dstUrl && (
                  <a
                    href={dstUrl}
                    download
                    className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
                  >
                    Download .DST
                  </a>
                )}
              </div>

              {/* DST Stitch Preview (collapsible) */}
              {showDstPreview && (
                <div className="w-full rounded-xl border border-white/8 bg-white/3 p-5">
                  {dstPreviewLoading ? (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
                      <p className="text-xs text-foreground/30">
                        Rendering stitch preview...
                      </p>
                    </div>
                  ) : dstPreviewUrl ? (
                    <div className="flex flex-col gap-5 sm:flex-row">
                      <div className="flex flex-1 flex-col items-center gap-3">
                        <div className="overflow-hidden rounded-lg border border-white/8 bg-surface">
                          <img
                            src={dstPreviewUrl}
                            alt="DST stitch preview"
                            className="max-h-[300px] w-full object-contain"
                          />
                        </div>
                        <a
                          href={dstPreviewUrl}
                          download="stitch-preview.png"
                          className="text-xs text-foreground/30 underline decoration-foreground/10 transition-colors hover:text-accent/60"
                        >
                          Download preview image
                        </a>
                      </div>

                      <div className="flex flex-col gap-4 sm:w-48">
                        <div>
                          <p className="mb-2 text-xs font-medium text-foreground/50">
                            Thread Colors
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {threadColors.map((tc, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2"
                              >
                                <div
                                  className="h-4 w-4 shrink-0 rounded-full border border-white/10"
                                  style={{ backgroundColor: tc.hex }}
                                />
                                <span className="font-mono text-xs text-foreground/40">
                                  {tc.hex}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 text-xs text-foreground/40">
                          <span>
                            {stitchCount.toLocaleString()} stitches
                          </span>
                          {dimensionsMm.length >= 2 && (
                            <span>
                              {dimensionsMm[0]} × {dimensionsMm[1]} mm
                            </span>
                          )}
                          <span>
                            {threadColors.length} thread color
                            {threadColors.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="py-4 text-center text-xs text-foreground/30">
                      Could not load stitch preview.
                    </p>
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
    </div>
  );
}

export default function CanvasPage() {
  return (
    <AuthGuard>
      <Suspense>
        <CanvasContent />
      </Suspense>
    </AuthGuard>
  );
}
