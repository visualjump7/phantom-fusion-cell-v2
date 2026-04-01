"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Briefcase, Eye, Loader2, X, CheckCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateUserRole, setUserAssignments, getUserAssignments } from "@/lib/user-service";
import { fetchClientProfiles, ClientProfile } from "@/lib/client-service";

interface ChangeRoleModalProps {
  open: boolean;
  userId: string;
  userName: string;
  currentRole: string;
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

export function ChangeRoleModal({ open, userId, userName, currentRole, onClose, onSuccess }: ChangeRoleModalProps) {
  const [role, setRole] = useState(currentRole);
  const [selectedPrincipals, setSelectedPrincipals] = useState<string[]>([]);
  const [principals, setPrincipals] = useState<ClientProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRole(currentRole);
      setError(null);
      fetchClientProfiles().then(setPrincipals);
      getUserAssignments(userId).then(setSelectedPrincipals);
    }
  }, [open, currentRole, userId]);

  const needsAssignment = role === "manager" || role === "viewer";
  const changingFromAssigned = currentRole === "manager" || currentRole === "viewer";
  const changingToAdmin = role === "admin" && changingFromAssigned;

  const handleSubmit = async () => {
    if (needsAssignment && selectedPrincipals.length === 0) {
      setError("At least one principal must be assigned for this role.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const roleResult = await updateUserRole(userId, role);
    if (!roleResult.success) {
      setError(roleResult.error || "Failed to update role.");
      setIsSubmitting(false);
      return;
    }

    // Update assignments if needed
    if (needsAssignment) {
      const assignResult = await setUserAssignments(userId, selectedPrincipals);
      if (!assignResult.success) {
        setError(assignResult.error || "Role updated but failed to update assignments.");
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
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
            <h2 className="text-lg font-semibold text-foreground">Change Role — {userName}</h2>
            <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Select Role</label>
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

            {changingToAdmin && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
                <p className="text-xs text-amber-400">
                  Changing to Admin will clear all principal assignments. Admins automatically see all principals.
                </p>
              </div>
            )}

            {needsAssignment && (
              <div>
                <label className="text-sm font-medium text-foreground">
                  Assign to Principals *
                </label>
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
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || role === currentRole}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
