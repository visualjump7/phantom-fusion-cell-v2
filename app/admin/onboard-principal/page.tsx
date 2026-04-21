"use client";

/**
 * Onboard-principal wizard — 5 steps to stand up a new principal.
 *
 *   1. Organization       — name, accent, primary contact
 *   2. Principal profile  — name, email, phone
 *   3. Module visibility  — checkboxes (Dashboard + Comms always on)
 *   4. Initial holdings   — "skip for now" placeholder (CSV import deferred)
 *   5. Confirm            — summary + Create button
 *
 * Server work runs in /api/admin/onboard-principal (see that file for the
 * full transaction). Success routes the admin to the new workspace.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  Sparkles,
  UploadCloud,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Circle,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { MODULE_METADATA } from "@/lib/module-metadata";
import { ALL_MODULE_KEYS, isRequiredModule, isDefaultModule } from "@/lib/modules";

const STEPS = [
  { id: "org", label: "Organization" },
  { id: "principal", label: "Principal" },
  { id: "modules", label: "Modules" },
  { id: "holdings", label: "Holdings" },
  { id: "confirm", label: "Confirm" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const ACCENTS = [
  { value: "green", class: "bg-emerald-500" },
  { value: "blue", class: "bg-blue-500" },
  { value: "amber", class: "bg-amber-500" },
  { value: "purple", class: "bg-purple-500" },
  { value: "teal", class: "bg-teal-500" },
  { value: "coral", class: "bg-orange-500" },
];

export default function OnboardPrincipalPage() {
  const router = useRouter();
  const [step, setStep] = useState<StepId>("org");

  // Org
  const [orgName, setOrgName] = useState("");
  const [accent, setAccent] = useState("green");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Principal
  const [principalName, setPrincipalName] = useState("");
  const [principalEmail, setPrincipalEmail] = useState("");
  const [principalPhone, setPrincipalPhone] = useState("");

  // Modules
  const [modules, setModules] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const k of ALL_MODULE_KEYS) base[k] = isDefaultModule(k);
    return base;
  });

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ orgId: string; principalId: string } | null>(null);

  const idx = STEPS.findIndex((s) => s.id === step);
  const canGoNext = useMemo(() => {
    if (step === "org") return orgName.trim().length > 0;
    if (step === "principal")
      return (
        principalName.trim().length > 0 &&
        /@/.test(principalEmail.trim())
      );
    return true;
  }, [step, orgName, principalName, principalEmail]);

  function go(direction: -1 | 1) {
    const next = STEPS[idx + direction];
    if (next) setStep(next.id);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/onboard-principal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: {
            name: orgName.trim(),
            accentColor: accent,
            primaryContactName: contactName.trim() || undefined,
            primaryContactEmail: contactEmail.trim() || undefined,
            primaryContactPhone: contactPhone.trim() || undefined,
          },
          principal: {
            fullName: principalName.trim(),
            email: principalEmail.trim(),
            phone: principalPhone.trim() || undefined,
          },
          modules,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong");
        setSubmitting(false);
        return;
      }
      setDone({ orgId: json.orgId, principalId: json.principalId });
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-auto max-w-xl px-4 py-16 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">Principal onboarded</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A confirmation email has been sent to <strong>{principalEmail}</strong> with a link to sign in.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => router.push("/admin")}>Back to Admin</Button>
            <Button onClick={() => router.push(`/admin/client/${done.orgId}`)}>
              Open workspace <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </motion.main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        {/* Stepper — wraps on narrow viewports so the 5 steps don't cause horizontal scroll. */}
        <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
          {STEPS.map((s, i) => {
            const done = i < idx;
            const active = i === idx;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className={
                    "flex h-6 w-6 items-center justify-center rounded-full " +
                    (done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : active
                        ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                </span>
                <span className={active ? "font-medium text-foreground" : ""}>{s.label}</span>
                {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground/60">·</span>}
              </li>
            );
          })}
        </ol>

        {step === "org" && (
          <StepCard icon={Building2} title="Organization" subtitle="Name the org that will own this principal's holdings.">
            <Input placeholder="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Accent</p>
              <div className="flex gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setAccent(a.value)}
                    className={
                      "h-7 w-7 rounded-full ring-2 transition " +
                      a.class +
                      (accent === a.value ? " ring-white" : " ring-transparent")
                    }
                    aria-label={`Accent ${a.value}`}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input placeholder="Primary contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              <Input placeholder="Primary contact email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <Input placeholder="Primary contact phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-3" />
          </StepCard>
        )}

        {step === "principal" && (
          <StepCard icon={Users} title="Principal profile" subtitle="The person who will log in to the nucleus.">
            <Input placeholder="Full name *" value={principalName} onChange={(e) => setPrincipalName(e.target.value)} />
            <Input placeholder="Email *" value={principalEmail} onChange={(e) => setPrincipalEmail(e.target.value)} className="mt-3" />
            <Input placeholder="Phone (optional)" value={principalPhone} onChange={(e) => setPrincipalPhone(e.target.value)} className="mt-3" />
            <p className="mt-3 text-xs text-muted-foreground">
              A confirmation email will be sent on create — they click the link to set their own password.
            </p>
          </StepCard>
        )}

        {step === "modules" && (
          <StepCard icon={Sparkles} title="Module visibility" subtitle="Which modules appear on their nucleus. You can change this later.">
            <p className="mb-3 text-xs text-muted-foreground">
              Defaults: Dashboard, Daily Brief, and Comms are enabled. Dashboard and Comms cannot be turned off.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ALL_MODULE_KEYS.map((key) => {
                const meta = MODULE_METADATA[key];
                const required = isRequiredModule(key);
                const checked = required ? true : modules[key];
                return (
                  <label
                    key={key}
                    className={
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition " +
                      (checked ? "border-primary/40 bg-primary/5" : "border-border hover:border-muted-foreground/40") +
                      (required ? " opacity-90" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={required}
                      onChange={(e) =>
                        setModules((m) => ({ ...m, [key]: e.target.checked }))
                      }
                      className="h-4 w-4"
                    />
                    <meta.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className="flex-1 truncate">{meta.label}</span>
                    {required && (
                      <span className="text-[10px] font-medium text-amber-400">required</span>
                    )}
                  </label>
                );
              })}
            </div>
          </StepCard>
        )}

        {step === "holdings" && (
          <StepCard icon={UploadCloud} title="Initial holdings" subtitle="Optional. You can skip and add holdings later from Projects.">
            <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              CSV import will be available in a post-launch update. For now, skip this step — you can add holdings manually or via bulk upload from the principal&apos;s workspace.
            </p>
          </StepCard>
        )}

        {step === "confirm" && (
          <StepCard icon={CheckCircle} title="Confirm" subtitle="Review everything and create the principal.">
            <dl className="space-y-2 text-sm">
              <Row label="Organization" value={orgName} />
              <Row label="Accent" value={accent} />
              <Row label="Principal" value={`${principalName} <${principalEmail}>`} />
              {principalPhone && <Row label="Phone" value={principalPhone} />}
              <Row
                label="Modules enabled"
                value={ALL_MODULE_KEYS.filter((k) => isRequiredModule(k) || modules[k]).map((k) => MODULE_METADATA[k].label).join(", ")}
              />
            </dl>
            {error && (
              <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}
          </StepCard>
        )}

        {/* Footer nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" disabled={idx === 0 || submitting} onClick={() => go(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {step === "confirm" ? (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Creating…</>
              ) : (
                <>Create principal <ArrowRight className="ml-1 h-4 w-4" /></>
              )}
            </Button>
          ) : (
            <Button onClick={() => go(1)} disabled={!canGoNext}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

function StepCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border bg-card/60">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm text-foreground">{value}</dd>
    </div>
  );
}
