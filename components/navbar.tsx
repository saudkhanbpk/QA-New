"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Bug, LogOut, LayoutDashboard, Plus, Shield, Menu, X } from "lucide-react";

interface NavbarProps {
  userEmail?: string | null;
  isAdmin?: boolean;
}

export function Navbar({ userEmail, isAdmin }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => {
    const buttonClass = mobile ? "w-full justify-start gap-2" : "gap-1 px-2 sm:px-3";
    
    return (
      <>
        {userEmail ? (
          <>
            <Button asChild variant="ghost" size="sm" className={buttonClass}>
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard className="h-4 w-4" />
                <span className={mobile ? "" : "hidden lg:inline"}>Dashboard</span>
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className={buttonClass}>
                <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Shield className="h-4 w-4" />
                  <span className={mobile ? "" : "hidden lg:inline"}>Admin</span>
                </Link>
              </Button>
            )}
            <Button asChild size="sm" className={buttonClass}>
              <Link href="/test/new" onClick={() => setMobileMenuOpen(false)}>
                <Plus className="h-4 w-4" />
                <span className={mobile ? "" : "hidden lg:inline"}>New Test</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className={buttonClass}>
              <LogOut className="h-4 w-4" />
              <span className={mobile ? "" : "hidden lg:inline"}>Sign out</span>
            </Button>
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm" className={buttonClass}>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Sign in</Link>
            </Button>
            <Button asChild size="sm" className={buttonClass}>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>Get started</Link>
            </Button>
          </>
        )}
      </>
    );
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative z-50">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold z-50">
          <Bug className="h-5 w-5 text-primary shrink-0" />
          <span className="truncate">QA Tester</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <NavLinks />
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 -mr-2 z-50 text-foreground"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="absolute top-14 left-0 w-full bg-background border-b shadow-lg md:hidden py-4 px-4 flex flex-col gap-2">
            <NavLinks mobile={true} />
          </div>
        )}
      </div>
    </nav>
  );
}
