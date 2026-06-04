"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Bug, LogOut, LayoutDashboard, Shield } from "lucide-react";
import navbarbg from "@/components/ui/navbarbg.jpg";

interface NavbarProps {
  userEmail?: string | null;
  isAdmin?: boolean;
}

export function Navbar({ userEmail: initialUserEmail, isAdmin: initialIsAdmin }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState(initialUserEmail);
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  useEffect(() => {
    setUserEmail(initialUserEmail);
    setIsAdmin(initialIsAdmin);
  }, [initialUserEmail, initialIsAdmin]);

  useEffect(() => {
    if (!userEmail) {
      const getSession = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email);
        }
      };
      getSession();
    }
  }, [userEmail, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setIsAdmin(false);
    router.push("/");
    router.refresh();
  }

  return (
    <nav
      className="backdrop-blur border-b relative z-50 shadow-sm"
      style={{
        backgroundImage: `url(${navbarbg.src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="container flex h-14 md:h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
          <Bug className="h-5 w-5 text-[#3388cc]" />
          <span className="hidden sm:inline md:text-2xl text-[#3388cc]">QA Tester</span>
          <span className="sm:hidden text-[#3388cc]">QA</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {userEmail ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1 shrink-0 text-white hover:bg-white/10">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Button>
              </Link>
              {isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="gap-1 shrink-0 text-white hover:bg-white/10">
                    <Shield className="h-4 w-4" />
                    <span className="hidden md:inline">Admin</span>
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1 shrink-0 text-white hover:bg-white/10">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">Sign in</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-[#3388cc] hover:bg-[#2877b3] text-white">Get started</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
