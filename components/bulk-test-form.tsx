"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronDown, Layers } from "lucide-react";

export function BulkTestForm() {
    const router = useRouter();
    const [urls, setUrls] = useState("");
    const [loading, setLoading] = useState(false);

    // Options state
    const [location] = useState("Seattle, WA, USA");
    const [browser] = useState("Chrome");
    const [connection] = useState("Unthrottled Connection");
    const [showOptions, setShowOptions] = useState(false);
    const [checks, setChecks] = useState<Record<string, boolean>>({
        performance: true,
        broken_links: true,
        compatibility: true,
        security: true,
        others: true,
    });

    const CHECKS_LIST = [
        { id: "performance", label: "Performance", desc: "Lighthouse & Vitals" },
        { id: "broken_links", label: "Links", desc: "Check for 404s" },
        { id: "compatibility", label: "Browser", desc: "Cross-platform" },
        { id: "security", label: "Security", desc: "Headers & SSL" },
        { id: "others", label: "Others", desc: "SEO & Access" },
    ];

    const toggleCheck = (id: string) => {
        setChecks(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const urlList = urls.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urlList.length === 0) return;

        setLoading(true);
        try {
            // Use a unique batch ID
            const batchId = crypto.randomUUID();
            const batchName = `Bulk Test - ${new Date().toLocaleString()}`;

            const submissions = await Promise.allSettled(
                urlList.map(async (testUrl) => {
                    return fetch("/api/test/run", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            url: testUrl,
                            viewports: ["desktop", "mobile"],
                            checks: checks,
                            batchId,
                            batchName
                        }),
                    }).then(res => res.json());
                })
            );

            // Redirect to batch page
            router.push(`/test/batch/${batchId}`);
        } catch (error) {
            console.error("Failed to start bulk test:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden mb-10">
            <div className="p-6 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* URL Rows */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">Enter URLs (One per line)</label>
                        <textarea
                            placeholder="https://example.com&#10;https://mysite.com/about"
                            value={urls}
                            onChange={(e) => setUrls(e.target.value)}
                            required
                            disabled={loading}
                            rows={6}
                            className="w-full p-4 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#004a6b] focus:border-[#004a6b] transition-all text-base font-mono bg-slate-50/50"
                        />
                        <div className="flex justify-between items-center text-[11px] text-slate-500 font-medium px-1">
                            <span>Maximum 20 URLs allowed in bulk mode</span>
                            <span>{urls.split('\n').filter(u => u.trim()).length} URLs entered</span>
                        </div>
                    </div>

                    {/* Options Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                        <div className="space-y-1.5 text-slate-900">
                            <label className="text-xs font-bold flex items-center gap-1">
                                Location <span className="text-slate-300">?</span>
                            </label>
                            <div className="flex items-center justify-between gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-not-allowed opacity-70">
                                <span className="truncate">{location}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold flex items-center gap-1 text-slate-900">
                                Device/Browser <span className="text-slate-300">?</span>
                            </label>
                            <div className="flex items-center justify-between gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-not-allowed opacity-70">
                                <span className="truncate">{browser}</span>
                                <ChevronDown className="h-3 w-3 opacity-50 " />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold flex items-center gap-1 text-slate-900">
                                Connection Speed <span className="text-slate-300">?</span>
                            </label>
                            <div className="flex items-center justify-between gap-2 border border-slate-300 rounded px-3 py-2 text-sm bg-white cursor-not-allowed opacity-70">
                                <span className="truncate">{connection}</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Checks */}
                    {showOptions && (
                        <div className="pt-4 border-t mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-[0.15em] block mb-4">Select Audits to Perform</label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {CHECKS_LIST.map((check) => (
                                    <div
                                        key={check.id}
                                        onClick={() => toggleCheck(check.id)}
                                        className={`cursor-pointer p-3 rounded-lg border transition-all flex flex-col gap-1 ${checks[check.id]
                                                ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200"
                                                : "bg-white border-slate-200 hover:border-slate-300"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[11px] font-bold uppercase tracking-wider ${checks[check.id] ? "text-blue-700" : "text-slate-600"}`}>
                                                {check.label}
                                            </span>
                                            <div className={`h-3.5 w-3.5 rounded-full border flex items-center justify-center ${checks[check.id] ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"}`}>
                                                {checks[check.id] && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] ${checks[check.id] ? "text-blue-600/70" : "text-slate-400"}`}>
                                            {check.desc}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex justify-center">
                        <Button
                            type="submit"
                            disabled={loading || !urls.trim()}
                            className="h-12 px-12 bg-[#004a6b] hover:bg-[#003a55] text-white font-bold rounded-md shadow-lg shadow-blue-900/10 transition-all flex items-center gap-2"
                        >
                            {loading ? (
                                <>Starting Bulk Analysis...</>
                            ) : (
                                <>
                                    <Layers className="h-4 w-4" />
                                    Run Bulk Performance Test
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Footer Options */}
            <div className="bg-slate-50/80 border-t px-6 py-2 flex justify-end">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOptions(!showOptions)}
                    className={`text-[11px] font-bold uppercase tracking-widest gap-1.5 rounded-md h-8 transition-colors ${showOptions ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "text-slate-500 hover:bg-slate-200 bg-slate-200"
                        }`}
                >
                    <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${showOptions ? "rotate-180" : ""}`} />
                    Bulk Options
                </Button>
            </div>
        </div>
    );
}
