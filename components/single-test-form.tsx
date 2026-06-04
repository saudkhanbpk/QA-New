"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Monitor, Zap, ChevronDown, Settings2, Play } from "lucide-react";

export function SingleTestForm() {
    const router = useRouter();
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);

    // Options state
    const [location] = useState("Seattle, WA, USA");
    const [browser] = useState("Chrome");
    const [connection] = useState("Unthrottled Connection");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) return;

        setLoading(true);
        try {
            const response = await fetch("/api/test/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url: url.trim(),
                    viewports: ["desktop", "mobile"], // Defaults
                    checks: {
                        performance: true,
                        broken_links: true,
                        compatibility: true,
                        security: true,
                        others: true,
                    }
                }),
            });

            const data = await response.json();
            if (data.testRunId) {
                router.push(`/test/new?id=${data.testRunId}&url=${encodeURIComponent(url.trim())}`);
            }
        } catch (error) {
            console.error("Failed to start test:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden mb-10">
            <div className="p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* URL Row */}
                    <div className="flex gap-0 relative">
                        <Input
                            type="url"
                            placeholder="Enter URL to Analyze..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            disabled={loading}
                            className="h-12 border-slate-300 rounded-r-none focus:ring-0 focus:z-10 text-base"
                        />
                        <Button
                            type="submit"
                            disabled={loading}
                            className="h-12 px-8 bg-[#004a6b] hover:bg-[#003a55] text-white font-bold rounded-l-none rounded-r-none border-l-0"
                        >
                            {loading ? "Analyzing..." : "Analyze"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-12 px-3 border-l-0 rounded-l-none bg-[#004a6b] text-white border-[#004a6b] hover:bg-[#003a55] hover:text-white"
                        >
                            <ChevronDown className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Options Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5 text-slate-900">
                            <label className="text-xs font-bold flex items-center gap-1">
                                Location <span className="text-slate-300">?</span>
                            </label>
                            <div className="flex items-center justify-between gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-pointer hover:border-slate-400 transition-colors">
                                <span className="truncate">{location}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold flex items-center gap-1 text-slate-900">
                                Device/Browser <span className="text-slate-300">?</span>
                            </label>
                            <div className="flex items-center justify-between gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-pointer hover:border-slate-400 transition-colors text-slate-900">
                                <span className="truncate">{browser}</span>
                                <ChevronDown className="h-3 w-3 opacity-50 text-slate-900" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold flex items-center gap-1 text-slate-900">
                                Connection Speed <span className="text-slate-300">?</span>
                            </label>
                            <div className="flex items-center justify-between gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-pointer hover:border-slate-400 transition-colors text-slate-900">
                                <span className="truncate">{connection}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Status Line */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-slate-500 pt-2">
                        <span className="font-bold uppercase tracking-wider text-slate-600">Using:</span>
                        <span className="font-bold text-[#004a6b]">{browser}</span>
                        <span>in</span>
                        <span className="font-bold text-[#004a6b]">{location}</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="font-bold uppercase tracking-wider text-slate-600">Connection:</span>
                        <span className="font-bold">Off</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="font-bold uppercase tracking-wider text-slate-600">Video:</span>
                        <span className="font-bold">Off</span>
                        <span className="mx-1 text-slate-300">|</span>
                        <span className="font-bold uppercase tracking-wider text-slate-600">Adblock:</span>
                        <span className="font-bold">Off</span>
                    </div>
                </form>
            </div>

            {/* Footer Options */}
            <div className="bg-slate-50/80 border-t px-6 py-2 flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-200 gap-1.5 bg-slate-200 rounded-md h-8"
                >
                    <ChevronDown className="h-3 w-3" />
                    Analysis Options
                </Button>
            </div>
        </div>
    );
}
