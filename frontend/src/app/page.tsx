"use client";

import Link from "next/link";
import ContourGraphic from "@/components/ContourGraphic";

export default function Home() {
  return (
    <div className="relative flex h-screen items-center overflow-hidden bg-background">
      {/* Contour graphic — offset left, large */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative -translate-x-[20%]">
          <ContourGraphic
            className="h-[88vh] w-auto"
            width={900}
            height={900}
            lineCount={34}
          />
        </div>
      </div>

      {/* Right content panel */}
      <div className="relative z-10 ml-auto flex w-[40%] flex-col items-end justify-center pr-12 lg:pr-20">
        <h1 className="leading-none">
          <span className="font-serif text-8xl italic text-foreground/95 lg:text-9xl">
            S
          </span>
          <span className="text-5xl font-extralight tracking-tight text-foreground/85 lg:text-6xl">
            UTURE
          </span>
        </h1>

        <div className="mt-6 flex flex-col items-end gap-1 text-base tracking-widest text-foreground/40">
          <span>Upload</span>
          <span>Convert</span>
          <span>Stitch</span>
        </div>

        <Link
          href="/build"
          className="mt-12 text-base font-medium tracking-wide text-accent transition-colors hover:text-accent/80"
        >
          Get Started →
        </Link>
      </div>
    </div>
  );
}
