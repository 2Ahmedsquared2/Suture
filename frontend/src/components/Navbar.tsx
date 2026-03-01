"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

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
        <Link
          href="#"
          className="text-foreground/40 hover:text-foreground/70 transition-colors"
        >
          Log In
        </Link>
        <Link
          href="#"
          className="text-foreground/80 hover:text-foreground transition-colors"
        >
          Sign Up
        </Link>
      </div>
    </nav>
  );
}
