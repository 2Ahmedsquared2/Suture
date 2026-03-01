"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ContourGraphic from "@/components/ContourGraphic";
import AuthGuard from "@/components/AuthGuard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type InputMode = "describe" | "upload";
type FlowState = "idle" | "loading" | "preview";

function BuildContent() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<InputMode>("describe");
  const [prompt, setPrompt] = useState("");
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enhancementNote, setEnhancementNote] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const clearPreview = () => {
    setFlowState("idle");
    setPreviewUrl(null);
    setImageId(null);
    setError(null);
    setEnhancementNote(null);
  };

  const handleGenerate = async (overridePrompt?: string) => {
    const text = (overridePrompt ?? prompt).trim();
    if (!text) return;

    setError(null);
    setFlowState("loading");

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);
      const res = await fetch(`${API}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Generation failed (${res.status})`);
      }

      const data = await res.json();
      setImageId(data.image_id);
      setPreviewUrl(`${API}${data.image_url}`);
      setFlowState("preview");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setError("Generation timed out. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
      setFlowState("idle");
    }
  };

  const handleUploadFile = useCallback(async (file: File) => {
    setError(null);
    setEnhancementNote(null);
    setFlowState("loading");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/upload-image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setImageId(data.image_id);
      setPreviewUrl(`${API}${data.image_url}`);
      if (data.enhanced && data.enhancement_note) {
        setEnhancementNote(data.enhancement_note);
      }
      setFlowState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setFlowState("idle");
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleGenerate();
  };

  const handleApprove = () => {
    if (imageId && previewUrl) {
      const params = new URLSearchParams({
        imageId,
        imageUrl: previewUrl,
      });
      if (mode === "describe" && prompt.trim()) {
        params.set("prompt", prompt.trim());
      }
      router.push(`/canvas?${params.toString()}`);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleReprompt = () => {
    clearPreview();
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) {
        handleUploadFile(file);
      } else {
        setError("Please drop an image file.");
      }
    },
    [handleUploadFile],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = "";
  };

  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background contour */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ContourGraphic
          className="h-[160vh] w-auto min-w-[160vw] opacity-[0.35]"
          width={1200}
          height={1200}
          lineCount={34}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6">
        {/* Preview state */}
        {flowState === "preview" && previewUrl && (
          <div className="mb-10 flex flex-col items-center gap-6 animate-in fade-in">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl shadow-black/40">
              <img
                src={previewUrl}
                alt="Generated preview"
                className="max-h-[50vh] max-w-full object-contain"
              />
            </div>
            {enhancementNote && (
              <p className="rounded-lg border border-accent/20 bg-accent/10 px-4 py-2 text-xs text-accent">
                {enhancementNote}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
              >
                Approve →
              </button>
              {mode === "describe" && (
                <button
                  onClick={handleRegenerate}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
                >
                  Regenerate
                </button>
              )}
              <button
                onClick={handleReprompt}
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
              >
                {mode === "describe" ? "Re-prompt" : "Re-upload"}
              </button>
            </div>
          </div>
        )}

        {/* Loading state */}
        {flowState === "loading" && (
          <div className="mb-10 flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
            <p className="text-sm tracking-wide text-foreground/40">
              {mode === "describe" ? "Generating your image..." : "Validating your image..."}
            </p>
          </div>
        )}

        {/* Input area — only show in idle or loading */}
        {flowState !== "preview" && (
          <div className="w-full">
            {/* Mode tabs */}
            <div className="mb-5 flex items-center gap-1 self-start rounded-lg bg-white/4 p-1">
              <button
                onClick={() => {
                  setMode("describe");
                  clearPreview();
                }}
                className={`rounded-md px-4 py-1.5 text-sm transition-all ${
                  mode === "describe"
                    ? "bg-white/8 text-accent"
                    : "text-foreground/40 hover:text-foreground/60"
                }`}
              >
                Describe
              </button>
              <button
                onClick={() => {
                  setMode("upload");
                  clearPreview();
                }}
                className={`rounded-md px-4 py-1.5 text-sm transition-all ${
                  mode === "upload"
                    ? "bg-white/8 text-accent"
                    : "text-foreground/40 hover:text-foreground/60"
                }`}
              >
                Upload
              </button>
            </div>

            <p className="mb-3 text-sm font-medium tracking-widest text-accent">
              Let&apos;s Build ...
            </p>

            {/* Text input mode */}
            {mode === "describe" && (
              <form onSubmit={handleSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want to embroider..."
                  disabled={flowState === "loading"}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.07] px-6 py-4 text-base text-foreground backdrop-blur-md outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/10 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!prompt.trim() || flowState === "loading"}
                  className="rounded-xl bg-accent px-6 py-4 text-sm font-medium text-background transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
                >
                  Generate
                </button>
              </form>
            )}

            {/* Upload mode */}
            {mode === "upload" && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 transition-all ${
                  isDragging
                    ? "border-accent/50 bg-accent/6"
                    : "border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/6"
                } ${flowState === "loading" ? "pointer-events-none opacity-50" : ""}`}
              >
                <svg
                  className="mb-3 h-8 w-8 text-foreground/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-sm text-foreground/40">
                  Drop an image here or{" "}
                  <span className="text-accent">browse</span>
                </p>
                <p className="mt-1 text-xs text-foreground/20">
                  PNG, JPG, or WebP — max 10 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}

            {/* Error message */}
            {error && (
              <p className="mt-3 text-sm text-red-400/90">{error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <AuthGuard>
      <BuildContent />
    </AuthGuard>
  );
}
