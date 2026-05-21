"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Preserve the deep-link target middleware bounced us off of so we can
  // route the user back there after sign-in. Validated as a same-origin
  // path before we use it.
  const redirectParam = searchParams.get("redirect_to");
  const safeRedirect =
    redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
      ? redirectParam
      : "/";
  // Error messages bubbled here from /auth/callback when a magic-link
  // exchange fails — surfaces them inline so the user knows what happened
  // instead of just seeing a blank login form.
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorParam);

  useEffect(() => {
    if (errorParam) setError(errorParam);
  }, [errorParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Normalize a couple of common Supabase errors so we don't surface
      // raw backend strings.
      const friendly =
        /invalid login credentials/i.test(error.message)
          ? "Email or password is incorrect."
          : /email not confirmed/i.test(error.message)
            ? "Check your inbox to confirm your account first."
            : error.message;
      setError(friendly);
      setIsLoading(false);
    } else {
      // replace() so /login doesn't sit in the back-history. Otherwise the
      // user hits Back from inside the app and gets bounced through the
      // middleware login redirect again.
      router.replace(safeRedirect);
      router.refresh();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {/* Background effects */}
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
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4">
            <span className="text-4xl font-bold text-foreground">
              Fusion <span className="text-primary">Cell</span>
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your world simplified.
          </p>
        </motion.div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-border bg-card/60 p-8 backdrop-blur-sm"
        >
          <form onSubmit={handleLogin} className="space-y-4">
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
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Forgot your password?
                </Link>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Invited to Fusion Cell? Check your email for the sign-in link.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams must be inside a Suspense boundary in Next.js 14
  // when using client components — wrap to satisfy the build.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
