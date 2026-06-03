"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

export function HeroUrlForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/test/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create test run.");
      }

      const params = new URLSearchParams({
        id: data.testRunId,
        url: url.trim(),
      });

      router.push(`/test/new?${params.toString()}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col md:flex-row w-full max-w-4xl gap-2">
      <Input
        type="url"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="flex-1 h-12 text-base"
        required
        disabled={loading}
      />
      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" className="gap-2 h-12 text-2xl bg-[#3388cc]" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><ArrowRight className="h-4 w-4" /> Run QA Test</>
          )}
        </Button>
        <Button type="button" size="lg" className="gap-2 h-12 bg-gray-500 hover:bg-gray-600" onClick={() => router.push("/register")}> 
          Login To Change Options
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </form>
  );
}
