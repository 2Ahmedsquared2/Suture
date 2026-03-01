"use client";

import { useCart, type CartItem } from "@/context/CartContext";
import ContourGraphic from "@/components/ContourGraphic";
import Link from "next/link";

function CartItemCard({
  item,
  onRemove,
}: {
  item: CartItem;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/8 bg-white/3 p-4 transition-colors hover:border-white/12">
      {item.designImageUrl && (
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/8 bg-surface">
          <img
            src={item.designImageUrl}
            alt="Design preview"
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-foreground/80 line-clamp-2">
            {item.details}
          </p>
          <button
            onClick={onRemove}
            className="shrink-0 text-foreground/20 transition-colors hover:text-red-400"
            title="Remove from cart"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/40">
          <span>Qty: {item.quantity}</span>
          {item.brand && <span>Brand: {item.brand}</span>}
          {item.colors && <span>Colors: {item.colors}</span>}
          <span>{item.stitchCount.toLocaleString()} stitches</span>
          <span>{item.threadColors} thread colors</span>
          {item.dimensionsMm.length >= 2 && (
            <span>
              {item.dimensionsMm[0]} x {item.dimensionsMm[1]} mm
            </span>
          )}
        </div>

        <div className="mt-1 rounded-lg border border-white/5 bg-white/2 p-3">
          <p className="text-xs font-medium text-foreground/30 mb-1">
            AI Quote
          </p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/60">
            {item.quoteText}
          </p>
        </div>

        {item.dstUrl && (
          <a
            href={item.dstUrl}
            download
            className="mt-1 self-start text-xs text-accent/70 underline decoration-accent/20 transition-colors hover:text-accent"
          >
            Download .DST
          </a>
        )}
      </div>
    </div>
  );
}

export default function CartPage() {
  const { items, removeItem, clearCart, count } = useCart();

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-[42vw] max-w-[550px] opacity-20">
        <ContourGraphic width={550} height={550} lineCount={18} />
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 pt-28 pb-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-medium text-foreground/90">
              Your Cart
            </h1>
            <p className="mt-1 text-sm text-foreground/40">
              {count === 0
                ? "No items yet"
                : `${count} item${count !== 1 ? "s" : ""} ready for production`}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {count > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-foreground/30 transition-colors hover:text-red-400"
              >
                Clear all
              </button>
            )}
            {count > 0 && (
              <button
                onClick={() => alert("Payment processing coming soon!")}
                className="rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
              >
                Pay Now
              </button>
            )}
          </div>
        </div>

        {count === 0 ? (
          <div className="flex flex-col items-center gap-5 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/8 bg-white/3">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                className="text-foreground/20"
              >
                <path
                  d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-foreground/40">Your cart is empty</p>
              <p className="mt-1 text-xs text-foreground/25">
                Get a manufacturing quote on a design to add it here
              </p>
            </div>
            <Link
              href="/build"
              className="mt-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-medium text-background transition-all hover:brightness-110"
            >
              Start a Design
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <CartItemCard
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
              />
            ))}

            <div className="mt-4 flex justify-end">
              <Link
                href="/build"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-foreground/70 transition-all hover:bg-white/10 hover:text-foreground"
              >
                + Add Another Design
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
