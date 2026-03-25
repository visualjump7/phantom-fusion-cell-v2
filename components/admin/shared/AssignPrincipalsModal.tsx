"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUserAssignments, setUserAssignments } from "@/lib/user-service";
import { fetchClientProfiles, ClientProfile } from "@/lib/client-service";

interface AssignPrincipalsModalProps {
  open: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignPrincipalsModal({ open, userId, userName, onClose, onSuccess }: AssignPrincipalsModalProps) {
  const [selectedPrincipals, setSelectedPrincipals] = useState<string[]>([]);
  const [principals, setPrincipals] = useState<ClientProfile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIsLoading(true);
      setError(null);
      Promise.all([
        fetchClientProfiles(),
        getUserAssignments(userId),
      ]).then(([profiles, assignments]) => {
        setPrincipals(profiles);
        setSelectedPrincipals(assignments);
        setIsLoading(false);
      });
    }
  }, [open, userId]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await setUserAssignments(userId, selectedPrincipals);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || "Failed to update assignments.");
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
          className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Assign Principals — {userName}</h2>
            </div>
            <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground mb-3">
                Select which principals this user can access.
              </p>
              {principals.map((p) => (
                <label
                  key={p.organization_id}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/30"
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
                <p className="text-xs text-muted-foreground py-4 text-center">No principals onboarded yet.</p>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isLoading}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Assignments
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
