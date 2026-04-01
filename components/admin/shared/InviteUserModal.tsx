"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, ShieldCheck, Briefcase, Eye, Loader2, X, CheckCircle, KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteUser } from "@/lib/user-service";
import { fetchClientProfiles, ClientProfile } from "@/lib/client-service";

interface InviteUserModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLE_CARDS = [
  {
    value: "admin",
    label: "Admin",
    icon: ShieldCheck,
    description: "Full access. Manages users, principals, and system settings.",
    color: "border-red-500/50 bg-red-500/5",
    iconColor: "text-red-400",
  },
  {
    value: "manager",
    label: "Manager",
    icon: Briefcase,
    description: "Day-to-day operations. Projects, budgets, bills, and messages.",
    color: "border-amber-500/50 bg-amber-500/5",
    iconColor: "text-amber-400",
  },
  {
    value: "viewer",
    label: "Viewer",
    icon: Eye,
    description: "Read-only access. Can view all data but cannot make changes.",
    color: "border-blue-500/50 bg-blue-500/5",
    iconColor: "text-blue-400",
  },
] as const;

export function InviteUserModal({ open, onClose, onSuccess }: InviteUserModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "viewer">("manager");
  const [selectedPrincipals, setSelectedPrincipals] = useState<string[]>([]);
  const [principals, setPrincipals] = useState<ClientProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchClientProfiles().then(setPrincipals);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("manager");
      setSelectedPrincipals([]);
      setError(null);
      setManualMessage(null);
    }
  }, [open]);

  const needsAssignment = role === "manager" || role === "viewer";

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (needsAssignment && selectedPrincipals.length === 0) {
      setError("At least one principal must be assigned for this role.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await inviteUser({
      email: email.trim(),
      fullName: fullName.trim(),
      password,
      role,
      principalOrgIds: needsAssignment ? selectedPrincipals : undefined,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Failed to invite user.");
      return;
    }

    onSuccess();
    onClose();
  };

  const togglePrincipal = (orgId: string) => {
    setSelectedPrincipals((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Invite Team Member</h2>
            </div>
            <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="text-sm font-medium text-foreground">Full Name *</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Sarah Johnson" className="mt-1" />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium text-foreground">Email *</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah@example.com" className="mt-1" />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-foreground">Temporary Password *</label>
              <div className="relative mt-1">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" className="pl-10" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Share this with the team member. They can change it in Settings.</p>
            </div>

            {/* Role */}
            <div>
              <label className="text-sm font-medium text-foreground">Role</label>
              <div className="mt-2 grid gap-2">
                {ROLE_CARDS.map((card) => {
                  const Icon = card.icon;
                  const isSelected = role === card.value;
                  return (
                    <button
                      key={card.value}
                      onClick={() => setRole(card.value)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        isSelected ? card.color : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <Icon className={`mt-0.5 h-4 w-4 ${isSelected ? card.iconColor : "text-muted-foreground"}`} />
                      <div>
                        <p className="text-sm font-medium text-foreground">{card.label}</p>
                        <p className="text-xs text-muted-foreground">{card.description}</p>
                      </div>
                      {isSelected && <CheckCircle className="ml-auto mt-0.5 h-4 w-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Principal Assignments (for manager/viewer) */}
            {needsAssignment && (
              <div>
                <label className="text-sm font-medium text-foreground">
                  Assign to Principals *
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select which principals this user can access.
                </p>
                <div className="mt-2 space-y-1.5">
                  {principals.map((p) => (
                    <label
                      key={p.organization_id}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPrincipals.includes(p.organization_id)}
                        onChange={() => togglePrincipal(p.organization_id)}
                        className="rounded border-border"
                      />
                      <span className="text-foreground">{p.display_name}</span>
                    </label>
                  ))}
                  {principals.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">No principals onboarded yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <UserPlus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
