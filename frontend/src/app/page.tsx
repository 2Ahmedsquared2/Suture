"use client";

import Link from "next/link";
import ContourGraphic from "@/components/ContourGraphic";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const { user, loading } = useAuth();

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
            animate
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

        {!loading && (
          <div className="mt-12 flex flex-col items-end gap-3">
            {user ? (
              <Link
                href="/build"
                className="text-base font-medium tracking-wide text-accent transition-colors hover:text-accent/80"
              >
                Get Started →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl bg-accent px-6 py-3 text-sm font-medium text-background transition-all hover:brightness-110"
                >
                  Log In to Get Started
                </Link>
                <Link
                  href="/signup"
                  className="text-sm text-foreground/30 transition-colors hover:text-foreground/50"
                >
                  Don&apos;t have an account? Sign Up
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
