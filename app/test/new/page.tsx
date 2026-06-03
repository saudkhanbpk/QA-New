import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
import { Navbar } from "@/components/navbar";
import { NewTestForm } from "@/components/new-test-form";

export default async function NewTestPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const params = await searchParams;
  const prefillUrl = params.url ? decodeURIComponent(params.url) : "";

  return (
    <div className="min-h-screen flex flex-col bg-gray-200 text-slate-900">
      <Navbar userEmail={user?.email} />
      <main className={`flex-1 ${prefillUrl ? 'max-w-screen-2xl mx-auto px-4 w-full' : 'container max-w-2xl'} py-8`}>
        {!prefillUrl && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">New QA Audit</h1>
            <p className="text-slate-600 text-sm mt-2">
              Deep-scan any website for performance, SEO, and security vulnerabilities.
            </p>
          </div>
        )}
        <div className="w-full">
          <NewTestForm prefillUrl={prefillUrl} />
        </div>
      </main>
    </div>
  );
}
