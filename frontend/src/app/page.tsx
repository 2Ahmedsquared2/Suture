"use client";

import Link from "next/link";
import ContourGraphic from "@/components/ContourGraphic";

export default function Home() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Nav */}
      <nav className="absolute top-0 right-0 z-10 flex items-center gap-6 px-10 py-6 text-sm">
        <Link href="#" className="text-muted hover:text-foreground transition-colors">
          Log In
        </Link>
        <Link
          href="#"
          className="text-foreground/90 hover:text-foreground transition-colors"
        >
          Sign Up
        </Link>
      </nav>

      {/* Contour graphic — left side */}
      <div className="absolute inset-y-0 -left-16 flex w-[60vw] items-center justify-center">
        <ContourGraphic
          className="h-[90vh] w-full opacity-90"
          width={900}
          height={900}
          lineCount={30}
          variant="hero"
        />
      </div>

      {/* Right content */}
      <div className="relative z-10 ml-auto flex w-[45%] flex-col items-end justify-center gap-2 pr-16">
        <h1 className="text-6xl font-light tracking-tight leading-none">
          <span className="font-serif text-7xl italic text-foreground/95">S</span>
          <span className="text-foreground/90">UTURE</span>
        </h1>

        <div className="mt-4 flex flex-col items-end gap-0.5 text-lg tracking-wide text-foreground/50">
          <span>Upload</span>
          <span>Convert</span>
          <span>Stitch</span>
        </div>

        <Link
          href="/build"
          className="mt-10 text-lg font-medium text-accent hover:text-accent/80 transition-colors"
        >
          Get Started&thinsp;→
        </Link>
      </div>
    </div>
  );
}
