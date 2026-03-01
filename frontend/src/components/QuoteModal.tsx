"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface QuoteModalProps {
  open: boolean;
  onClose: () => void;
  designImageUrl: string | null;
  dstUrl: string | null;
  stitchCount: number;
  threadColors: number;
  dimensionsMm: number[];
  /** When true the first "ask" screen is skipped and the form shows immediately. */
  skipAsk?: boolean;
}

type Step = "ask" | "form" | "loading" | "result";

export default function QuoteModal({
  open,
  onClose,
  designImageUrl,
  dstUrl,
  stitchCount,
  threadColors,
  dimensionsMm,
  skipAsk = false,
}: QuoteModalProps) {
  const { addItem } = useCart();

  const [step, setStep] = useState<Step>(skipAsk ? "form" : "ask");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState(5);
  const [brand, setBrand] = useState("");
  const [colors, setColors] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const reset = () => {
    setStep(skipAsk ? "form" : "ask");
    setDetails("");
    setQuantity(5);
    setBrand("");
    setColors("");
    setResult(null);
    setError(null);
    setAddedToCart(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleJustDownload = () => {
    handleClose();
    if (dstUrl) {
      const a = document.createElement("a");
      a.href = dstUrl;
      a.download = "embroidery.dst";
      a.click();
    }
  };

  const handleSubmit = async () => {
    if (quantity < 5) {
      setError("Minimum order quantity is 5.");
      return;
    }
    if (!details.trim()) {
      setError("Please describe your order.");
      return;
    }

    setStep("loading");
    setError(null);

    try {
      const res = await fetch(`${API}/openclaw-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          details,
          quantity,
          brand_preference: brand,
          colors,
          stitch_count: stitchCount,
          thread_colors: threadColors,
          dimensions_mm: dimensionsMm,
        }),
        signal: AbortSignal.timeout(150000),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail ?? `Quote request failed (${res.status})`);
      }

      const data = await res.json();
      setResult(data.quote_text);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote.");
      setStep("form");
    }
  };

  const handleAddToCart = () => {
    addItem({
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
      designImageUrl,
      dstUrl,
      quoteText: result || "",
      details,
      quantity,
      brand,
      colors,
      stitchCount,
      threadColors,
      dimensionsMm,
    });
    setAddedToCart(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-foreground/30 transition-colors hover:text-foreground/70"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Step: Ask */}
        {step === "ask" && (
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 7H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
                <path d="M16 3H8v4h8V3Z" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
                <path d="M10 20h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground">Want this design made for you?</h3>
              <p className="mt-1 text-sm text-foreground/40">
                We can produce this embroidery on real garments. Minimum order: 5 units.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button
                onClick={handleJustDownload}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
              >
                No, just download
              </button>
              <button
                onClick={() => setStep("form")}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
              >
                Yes, get a quote
              </button>
            </div>
          </div>
        )}

        {/* Step: Form */}
        {step === "form" && (
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-medium text-foreground">Order Details</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/50">
                Describe your order *
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="E.g. Custom embroidered hoodies for my team event, need logo on front left chest..."
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:border-accent/50 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/50">
                  Quantity (min 5) *
                </label>
                <input
                  type="number"
                  min={5}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(5, Number(e.target.value)))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground/50">
                  Brand / Garment
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="E.g. Gildan, Nike..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:border-accent/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/50">
                Garment Colors
              </label>
              <input
                type="text"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                placeholder="E.g. Black, Navy, White..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-foreground/20 focus:border-accent/50 focus:outline-none"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={skipAsk ? handleClose : () => setStep("ask")}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10"
              >
                {skipAsk ? "Cancel" : "Back"}
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
              >
                Get Price Quote
              </button>
            </div>
          </div>
        )}

        {/* Step: Loading */}
        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-accent" />
            <div className="text-center">
              <p className="text-sm text-foreground/60">Getting your price quote...</p>
              <p className="mt-1 text-xs text-foreground/30">
                Our AI pricing agent is calculating your custom quote
              </p>
            </div>
          </div>
        )}

        {/* Step: Result */}
        {step === "result" && result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5l3.5 3.5L13 4" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-foreground">Your Quote</h3>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/70">
                {result}
              </p>
            </div>

            {addedToCart ? (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-green-400">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-sm font-medium">Added to cart</span>
                </div>
                <div className="flex w-full gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10"
                  >
                    Continue
                  </button>
                  <a
                    href="/cart"
                    className="flex flex-1 items-center justify-center rounded-xl bg-accent py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
                  >
                    View Cart
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10"
                >
                  No thanks
                </button>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
                >
                  Add to Cart
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
