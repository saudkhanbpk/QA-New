"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Bug, Loader2 } from "lucide-react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // First, check if email already exists
      const checkResponse = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkResponse.json();

      if (checkData.exists) {
        if (checkData.verified) {
          // Email exists and is verified - show error
          setError("This email is already registered. Please sign in instead.");
          setLoading(false);
          return;
        } else {
          // Email exists but not verified - resend confirmation email
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/dashboard`,
            },
          });

          setLoading(false);

          if (resendError) {
            setError(resendError.message);
            return;
          }

          // Show success message
          setEmailSent(true);
          return;
        }
      }

      // Email doesn't exist - proceed with registration
      const isAdminAccount = email.toLowerCase() === "admin@autoqa.com";

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            email_verified: isAdminAccount
          }
        },
      });

      setLoading(false);

      if (error) {
        setError(error.message);
        return;
      }

      // If admin account, redirect directly to login
      if (isAdminAccount) {
        router.push("/login?message=Admin account created. Please sign in.");
        return;
      }

      // Show email confirmation message for regular users
      setEmailSent(true);
    } catch (error: any) {
      setLoading(false);
      setError("An error occurred. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Bug className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Start testing webpages for free</CardDescription>
        </CardHeader>
        
        {emailSent ? (
          <CardContent className="space-y-4">
            <div className="text-center space-y-3 py-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Check your email</h3>
                <p className="text-sm text-muted-foreground">
                  We've sent a confirmation email to <span className="font-medium text-foreground">{email}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please click the confirmation link in the email to activate your account.
                </p>
              </div>
            </div>
            <div className="pt-4 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Didn't receive the email? Check your spam folder or{" "}
                <button 
                  onClick={() => { setEmailSent(false); setEmail(""); setPassword(""); }} 
                  className="text-primary hover:underline"
                >
                  try again
                </button>
              </p>
            </div>
          </CardContent>
        ) : (
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {error && (
                <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
