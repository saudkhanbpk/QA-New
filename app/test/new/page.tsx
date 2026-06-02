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
    <div className="min-h-screen flex flex-col">
      <Navbar userEmail={user?.email} />
      <main className="flex-1 container py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">New QA Test</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure and run automated checks on any webpage.
          </p>
        </div>
        <NewTestForm prefillUrl={prefillUrl} />
      </main>
    </div>
  );
}
