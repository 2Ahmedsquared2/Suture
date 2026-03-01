"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { user, loading, logout } = useAuth();
  const { count } = useCart();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5">
      <Link href="/" className="flex items-baseline gap-0.5 group">
        <span className="font-serif text-2xl italic text-foreground/90 group-hover:text-foreground transition-colors">
          S
        </span>
        <span className="text-sm font-light tracking-[0.25em] text-foreground/70 group-hover:text-foreground/90 transition-colors">
          UTURE
        </span>
      </Link>

      <div className="flex items-center gap-8 text-sm">
        {!isHome && (
          <Link
            href="/build"
            className={`relative transition-colors ${
              pathname === "/build"
                ? "text-accent"
                : "text-foreground/40 hover:text-foreground/70"
            }`}
          >
            Build
            {pathname === "/build" && (
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px]">
                🪡
              </span>
            )}
          </Link>
        )}

        {!loading && user && (
          <Link
            href="/sutures"
            className={`transition-colors ${
              pathname === "/sutures"
                ? "text-accent"
                : "text-foreground/40 hover:text-foreground/70"
            }`}
          >
            My Sutures
          </Link>
        )}

        <Link
          href="/cart"
          className={`relative transition-colors ${
            pathname === "/cart"
              ? "text-accent"
              : "text-foreground/40 hover:text-foreground/70"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="inline-block">
            <path
              d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {count > 0 && (
            <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-background">
              {count}
            </span>
          )}
        </Link>

        {loading ? (
          <span className="h-4 w-16 animate-pulse rounded bg-white/5" />
        ) : user ? (
          <div className="flex items-center gap-4">
            <span className="text-foreground/50">{user.name}</span>
            <button
              onClick={logout}
              className="text-foreground/30 transition-colors hover:text-foreground/60"
            >
              Log Out
            </button>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="text-foreground/40 hover:text-foreground/70 transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-foreground/80 hover:text-foreground transition-colors"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
