"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ContourGraphic from "@/components/ContourGraphic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ThreadColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

interface Suture {
  id: string;
  prompt: string | null;
  original_image_url: string | null;
  preprocessed_image_url: string | null;
  svg_url: string | null;
  dst_url: string | null;
  dst_id: string | null;
  stitch_count: number;
  dimensions_mm: number[] | null;
  thread_colors: ThreadColor[] | null;
  svg_reviewed: boolean;
  dst_reviewed: boolean;
  agent_feedback: string | null;
  created_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SuturesPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [sutures, setSutures] = useState<Suture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) {
      router.push("/login");
      return;
    }

    fetch(`${API}/sutures`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load sutures.");
        return res.json();
      })
      .then((data) => setSutures(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Something went wrong."),
      )
      .finally(() => setLoading(false));
  }, [user, token, authLoading, router]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pt-24 pb-16">
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42vw] max-w-[550px] opacity-10">
        <ContourGraphic width={550} height={550} lineCount={18} />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-8">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-widest text-foreground/90">
              My Sutures
            </h1>
            <p className="mt-2 text-sm text-foreground/30">
              Your previous embroidery conversions
            </p>
          </div>
          <Link
            href="/build"
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
          >
            New Suture →
          </Link>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
          </div>
        )}

        {error && (
          <p className="py-20 text-center text-sm text-red-400/90">{error}</p>
        )}

        {!loading && !error && sutures.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-24">
            <div className="text-5xl opacity-20">🪡</div>
            <p className="text-sm text-foreground/30">
              No sutures yet. Create your first one!
            </p>
            <Link
              href="/build"
              className="mt-2 text-sm text-accent transition-colors hover:text-accent/80"
            >
              Get Started →
            </Link>
          </div>
        )}

        {!loading && !error && sutures.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sutures.map((s) => (
              <div
                key={s.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-surface transition-all hover:border-white/15"
              >
                {/* Preview image */}
                <div className="relative aspect-square overflow-hidden bg-background">
                  {s.svg_url ? (
                    <img
                      src={s.svg_url}
                      alt={s.prompt ?? "Suture"}
                      className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105"
                    />
                  ) : s.preprocessed_image_url ? (
                    <img
                      src={s.preprocessed_image_url}
                      alt={s.prompt ?? "Suture"}
                      className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105"
                    />
                  ) : s.original_image_url ? (
                    <img
                      src={s.original_image_url}
                      alt={s.prompt ?? "Suture"}
                      className="h-full w-full object-contain p-4 transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-10">
                      🪡
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-3 p-4">
                  {s.prompt && (
                    <p className="line-clamp-2 text-sm text-foreground/70">
                      {s.prompt}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/30">
                    {s.stitch_count > 0 && (
                      <span>{s.stitch_count.toLocaleString()} stitches</span>
                    )}
                    {s.dimensions_mm && s.dimensions_mm.length === 2 && (
                      <span>
                        {s.dimensions_mm[0]} × {s.dimensions_mm[1]} mm
                      </span>
                    )}
                  </div>

                  {/* Thread colors */}
                  {s.thread_colors && s.thread_colors.length > 0 && (
                    <div className="flex items-center gap-1">
                      {s.thread_colors.slice(0, 8).map((tc, i) => (
                        <div
                          key={i}
                          className="h-3 w-3 rounded-full border border-white/10"
                          style={{ backgroundColor: tc.hex }}
                        />
                      ))}
                      {s.thread_colors.length > 8 && (
                        <span className="text-[10px] text-foreground/20">
                          +{s.thread_colors.length - 8}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Review badges */}
                  {(s.svg_reviewed || s.dst_reviewed) && (
                    <div className="flex gap-1.5">
                      {s.svg_reviewed && (
                        <span className="rounded-full border border-green-500/15 bg-green-500/5 px-2 py-0.5 text-[10px] text-green-400/60">
                          SVG reviewed
                        </span>
                      )}
                      {s.dst_reviewed && (
                        <span className="rounded-full border border-green-500/15 bg-green-500/5 px-2 py-0.5 text-[10px] text-green-400/60">
                          DST optimized
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-xs text-foreground/20">
                      {formatDate(s.created_at)}
                    </span>
                    {s.dst_url && (
                      <a
                        href={s.dst_url}
                        download
                        className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-all hover:bg-accent/20"
                      >
                        Download .DST
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
