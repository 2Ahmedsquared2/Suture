"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import ContourGraphic from "@/components/ContourGraphic";

export default function SignupPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setError(null);
    setLoading(true);

    try {
      await register(email, name, password);
      router.push("/build");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ContourGraphic
          className="h-[160vh] w-auto min-w-[160vw] opacity-[0.15]"
          width={1200}
          height={1200}
          lineCount={34}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-light tracking-widest text-foreground/90">
            Sign Up
          </h1>
          <p className="mt-2 text-sm text-foreground/30">
            Create your Suture account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="rounded-xl border border-white/10 bg-white/[0.07] px-5 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/10"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="rounded-xl border border-white/10 bg-white/[0.07] px-5 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/10"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 characters)"
            required
            minLength={6}
            className="rounded-xl border border-white/10 bg-white/[0.07] px-5 py-3.5 text-sm text-foreground outline-none transition-all placeholder:text-foreground/25 focus:border-accent/30 focus:bg-white/10"
          />

          {error && (
            <p className="text-sm text-red-400/90">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-medium text-background transition-all hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-foreground/30">
          Already have an account?{" "}
          <Link href="/login" className="text-accent transition-colors hover:text-accent/80">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}
