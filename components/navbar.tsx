"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Bug, LogOut, LayoutDashboard, Plus, Shield } from "lucide-react";

interface NavbarProps {
  userEmail?: string | null;
  isAdmin?: boolean;
}

export function Navbar({ userEmail, isAdmin }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  // Debug: Log the email and admin status
  console.log("Navbar - Email:", userEmail, "IsAdmin:", isAdmin);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
          <Bug className="h-5 w-5 text-primary" />
          <span className="hidden sm:inline">QA Tester</span>
          <span className="sm:hidden">QA</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {userEmail ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1 shrink-0">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="gap-1 shrink-0">
                    <Shield className="h-4 w-4" />
                    <span className="hidden md:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <Link href="/test/new">
                <Button size="sm" className="gap-1 shrink-0">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Test</span>
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1 shrink-0">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
