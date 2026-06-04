"use client";

import { X } from "lucide-react";
import bannerBg from "@/components/ui/dashboard_hero_bg.png";

interface DashboardBannerProps {
    userEmail?: string | null;
}

export function DashboardBanner({ userEmail }: DashboardBannerProps) {
    const username = userEmail ? userEmail.split('@')[0] : "Muhammad";

    return (
        <div
            className="relative overflow-hidden rounded-xl p-8 mb-8 text-white shadow-lg border border-white/5"
            style={{
                backgroundImage: `linear-gradient(to right, rgba(20, 40, 80, 0.9) 0%, rgba(30, 60, 100, 0.7) 100%), url(${bannerBg.src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {/* <button className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
                <X className="h-5 w-5" />
            </button> */}

            <div className="flex flex-col lg:flex-row items-center gap-12 relative z-10">
                <div className="flex-1 space-y-4">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Welcome {username.charAt(0).toUpperCase() + username.slice(1)}!
                    </h1>
                    <div className="space-y-4">
                        <p className="text-blue-100 text-xl font-medium">
                            Get up and running using QA Tester with 3 easy tours.
                        </p>
                        <p className="text-blue-100/70 text-sm max-w-xl">
                            We'll walk you through analyzing a page, understanding a report and setting up monitoring and alerts.
                        </p>
                        {/* <button className="text-blue-300 hover:text-blue-200 text-sm font-semibold underline decoration-blue-300/30 underline-offset-4">
                            Skip tours for now
                        </button> */}
                    </div>
                </div>

                <div className="flex flex-wrap justify-center gap-4">
                    {/* Analyze a Page Card */}
                    <div className="w-56 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group cursor-pointer hover:bg-white/10 transition-all">
                        <div className="aspect-video bg-blue-500/20 flex items-center justify-center p-4">
                            <div className="w-full h-full border-2 border-white/20 rounded relative">
                                <div className="absolute inset-x-2 top-4 h-0.5 bg-blue-400 opacity-50" />
                                <div className="absolute inset-x-4 top-8 h-1 bg-white opacity-20 rounded-full" />
                            </div>
                        </div>
                        <div className="p-3 text-center bg-black/40">
                            <span className="text-sm font-bold">Analyze a Page</span>
                        </div>
                    </div>

                    {/* Understand Reports Card */}
                    <div className="w-56 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group cursor-pointer hover:bg-white/10 transition-all">
                        <div className="aspect-video bg-slate-500/20 flex items-center justify-center p-4">
                            <div className="w-full bg-white rounded-sm p-2 flex flex-col gap-1">
                                <div className="h-1 w-1/2 bg-blue-500/50 rounded-full" />
                                <div className="h-3 w-full bg-slate-100 rounded-sm" />
                                <div className="flex gap-1">
                                    <div className="h-2 w-4 bg-green-500/30 rounded" />
                                    <div className="h-2 w-4 bg-red-500/30 rounded" />
                                </div>
                            </div>
                        </div>
                        <div className="p-3 text-center bg-black/40">
                            <span className="text-sm font-bold">Understand Reports</span>
                        </div>
                    </div>

                    {/* Set Up Monitoring Card */}
                    <div className="w-56 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg overflow-hidden group cursor-pointer hover:bg-white/10 transition-all">
                        <div className="aspect-video bg-indigo-500/20 flex items-center justify-center p-4">
                            <div className="w-full h-full border-b border-l border-white/20 flex items-end p-1 gap-1">
                                <div className="h-1/2 w-1 bg-blue-400 shadow-sm shadow-blue-400" />
                                <div className="h-3/4 w-1 bg-indigo-400 shadow-sm shadow-indigo-400" />
                                <div className="h-1/3 w-1 bg-purple-400 shadow-sm shadow-purple-400" />
                            </div>
                        </div>
                        <div className="p-3 text-center bg-black/40">
                            <span className="text-sm font-bold">Set Up Monitoring & Alerts</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
