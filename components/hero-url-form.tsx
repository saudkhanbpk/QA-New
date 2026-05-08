"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";

export function HeroUrlForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [url, setUrl] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    if (!isLoggedIn) {
      router.push("/register");
      return;
    }
    const encoded = encodeURIComponent(url.trim());
    router.push(`/test/new?url=${encoded}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-lg gap-2">
      <Input
        type="url"
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="flex-1 h-12 text-base"
        required
      />
      <Button type="submit" size="lg" className="gap-2 h-12">
        Run QA Test
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}
