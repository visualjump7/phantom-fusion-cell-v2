"use client";

/**
 * /forgot-password — self-serve password reset request.
 *
 * Calls supabase.auth.resetPasswordForEmail with a redirect to /auth/reset.
 * Supabase emails the recovery link; clicking it lands on /auth/reset with
 * a recovery session, where the user sets a new password.
 *
 * The success state always shows the same generic message regardless of
 * whether the email exists in the system — prevents email enumeration.
 *
 * Manual Supabase setup required (see deployment checklist):
 *   - Authentication → Email Templates → "Reset Password" template enabled
 *   - Authentication → URL Configuration → add `<your-domain>/auth/reset`
 *     to the redirect URL allow-list
 */

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/@/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${origin}/auth/reset` }
    );
    setIsLoading(false);

    if (resetErr) {
      // Rate limit or invalid email format — surface a generic message so
      // we don't reveal whether the address exists in the system.
      console.error("[forgot-password]", resetErr);
    }
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md px-4"
      >
        <div className="mb-8 text-center">
          <span className="text-4xl font-bold text-foreground">
            Fusion <span className="text-primary">Cell</span>
          </span>
          <p className="mt-1 text-sm text-muted-foreground">
            Your world simplified.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-8 backdrop-blur-sm">
          {submitted ? (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <Mail className="h-5 w-5 text-emerald-400" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                Check your inbox
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                If an account exists for <strong>{email.trim()}</strong>,
                we&apos;ve sent a link to set a new password. The link expires
                in one hour.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-foreground">
                  Reset your password
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a link to set a new
                  password.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>

              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
