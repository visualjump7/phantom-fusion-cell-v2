"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users, ArrowRight, ArrowLeft, Loader2, CheckCircle, Palette, Tag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClientProfile } from "@/lib/client-service";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS = [
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "teal", label: "Teal", class: "bg-teal-500" },
  { value: "purple", label: "Purple", class: "bg-purple-500" },
  { value: "coral", label: "Coral", class: "bg-orange-500" },
  { value: "pink", label: "Pink", class: "bg-pink-500" },
  { value: "green", label: "Green", class: "bg-emerald-500" },
];

const CATEGORY_OPTIONS = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "family", label: "Family" },
];

type Step = "details" | "accent" | "categories" | "contact" | "creating" | "done";

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");

  // Form state
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accentColor, setAccentColor] = useState("amber");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [allowedCategories, setAllowedCategories] = useState<string[]>(["business", "personal", "family"]);
  const [error, setError] = useState<string | null>(null);
  const [newOrgId, setNewOrgId] = useState<string | null>(null);

  const handleCreate = async () => {
    setStep("creating"); setError(null);
    try {
      const result = await createClientProfile({
        organizationName: name.trim(),
        displayName: displayName.trim() || name.trim(),
        accentColor,
        primaryContactName: contactName.trim() || undefined,
        primaryContactEmail: contactEmail.trim() || undefined,
        primaryContactPhone: contactPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        allowedCategories,
      });
      if (!result.success) throw new Error(result.error);
      setNewOrgId(result.orgId!);
      setStep("done");
    } catch (err: any) {
      setError(err.message || "Failed to create principal.");
      setStep("contact");
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Onboard New Principal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Set up a new principal workspace.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {["Details", "Accent", "Categories", "Contact", "Done"].map((label, i) => {
          const stepMap = ["details", "accent", "categories", "contact", "done"];
          const currentIndex = stepMap.indexOf(step === "creating" ? "contact" : step);
          const isActive = i <= currentIndex;
          return (
            <span key={label} className="flex items-center gap-2">
              {i > 0 && <span className="h-px w-4 bg-border" />}
              <span className={`rounded-full px-2 py-0.5 ${isActive ? "bg-primary/10 text-primary font-medium" : ""}`}>{label}</span>
            </span>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Details step */}
      {step === "details" && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <div><label className="text-sm font-medium text-foreground">Organization Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Smith Family Office" className="mt-1" /></div>
          <div><label className="text-sm font-medium text-foreground">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Smith Family (defaults to org name)" className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">How this principal appears in the admin dashboard.</p>
          </div>
          <div className="flex justify-end">
            <Button disabled={!name.trim()} onClick={() => setStep("accent")}><ArrowRight className="mr-2 h-4 w-4" />Next</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Accent color step */}
      {step === "accent" && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Choose an accent color for this workspace</p>
          </div>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
            {ACCENT_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setAccentColor(opt.value)}
                className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
                  accentColor === opt.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30")}>
                <span className={`h-6 w-6 rounded-full ${opt.class}`} />
                <span className="text-xs text-muted-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("details")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={() => setStep("categories")}><ArrowRight className="mr-2 h-4 w-4" />Next</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Categories step */}
      {step === "categories" && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Asset Categories</p>
          </div>
          <p className="text-xs text-muted-foreground">Select which asset categories this principal will use. At least one is required.</p>
          <div className="flex flex-wrap gap-3">
            {CATEGORY_OPTIONS.map((opt) => {
              const selected = allowedCategories.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    if (selected && allowedCategories.length <= 1) return;
                    setAllowedCategories((prev) =>
                      selected ? prev.filter((c) => c !== opt.value) : [...prev, opt.value]
                    );
                  }}
                  className={cn(
                    "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("accent")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={() => setStep("contact")}><ArrowRight className="mr-2 h-4 w-4" />Next</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Contact step */}
      {step === "contact" && (
        <Card className="border-border"><CardContent className="p-6 space-y-4">
          <p className="text-sm font-medium text-foreground">Primary Contact (optional)</p>
          <div><label className="text-xs text-muted-foreground">Name</label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">Email</label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">Phone</label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="mt-1" /></div>
          <div><label className="text-xs text-muted-foreground">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none" /></div>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep("categories")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
            <Button onClick={handleCreate}><Users className="mr-2 h-4 w-4" />Create Workspace</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Creating step */}
      {step === "creating" && (
        <Card className="border-border"><CardContent className="flex flex-col items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm font-medium">Creating workspace...</p>
        </CardContent></Card>
      )}

      {/* Done step */}
      {step === "done" && (
        <Card className="border-border"><CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500" />
          <p className="mt-4 text-lg font-semibold text-foreground">Workspace Created</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {displayName || name} has been onboarded successfully.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => router.push("/admin")}>Back to Admin</Button>
            {newOrgId && <Button onClick={() => router.push(`/admin/client/${newOrgId}`)}>Open Workspace</Button>}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
