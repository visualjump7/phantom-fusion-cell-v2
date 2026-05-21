"use client";

/**
 * /auth/reset — landing page for the password-recovery email link.
 *
 * Supabase fires a PASSWORD_RECOVERY auth event when the user lands on this
 * page via the recovery link in their email. While that session is active
 * the user can call `auth.updateUser({ password })` to set a new password
 * without proving the old one.
 *
 * Sits under `/auth/*` so middleware treats it as a public route — the
 * recovery session is what unlocks the update, not a prior signed-in state.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Phase = "loading" | "ready" | "invalid" | "saving" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Supabase fires PASSWORD_RECOVERY synchronously after parsing the recovery
  // token from the URL fragment. We listen for it (or for an existing
  // session, which is the same effective state) before showing the form.
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPhase("ready");
      else if (event === "SIGNED_IN" && session) setPhase("ready");
    });

    // Belt-and-suspenders: if the session already exists when this mounts
    // (e.g. the user refreshes the page), don't get stuck on "loading".
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPhase((p) => (p === "loading" ? "ready" : p));
      } else {
        // Give the auth listener a moment to fire — if nothing arrives in
        // 1.5s, the link was probably invalid or expired.
        setTimeout(() => {
          setPhase((p) => (p === "loading" ? "invalid" : p));
        }, 1500);
      }
    });

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPhase("saving");
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    if (updateErr) {
      setError(updateErr.message);
      setPhase("ready");
      return;
    }
    setPhase("done");
    // Brief delay so the user sees the "done" state, then bounce to home.
    setTimeout(() => {
      router.replace("/");
    }, 1400);
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
        </div>

        <div className="rounded-2xl border border-border bg-card/60 p-8 backdrop-blur-sm">
          {phase === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Verifying recovery link…
              </p>
            </div>
          )}

          {phase === "invalid" && (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-foreground">
                Link expired or invalid
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Recovery links are good for one hour. Request a new one to keep
                going.
              </p>
              <Button
                onClick={() => router.push("/forgot-password")}
                className="mt-4 w-full"
              >
                Get a new link
              </Button>
            </div>
          )}

          {phase === "done" && (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <h1 className="text-lg font-semibold text-foreground">
                Password updated
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Signing you in…
              </p>
            </div>
          )}

          {(phase === "ready" || phase === "saving") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <h1 className="text-lg font-semibold text-foreground">
                    Set a new password
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose something at least 8 characters long.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  New password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Confirm password
                </label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={phase === "saving"}
              >
                {phase === "saving" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save new password"
                )}
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
