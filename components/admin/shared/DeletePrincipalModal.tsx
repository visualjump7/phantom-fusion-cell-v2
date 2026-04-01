"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchDeletionCounts, DeletionCounts } from "@/lib/client-service";

interface DeletePrincipalModalProps {
  open: boolean;
  orgId: string;
  principalName: string;
  onConfirmDelete: () => Promise<void>;
  onCancel: () => void;
}

export function DeletePrincipalModal({
  open,
  orgId,
  principalName,
  onConfirmDelete,
  onCancel,
}: DeletePrincipalModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [counts, setCounts] = useState<DeletionCounts | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setConfirmText("");
      setCounts(null);
      return;
    }
    setLoadingCounts(true);
    fetchDeletionCounts(orgId).then((data) => {
      setCounts(data);
      setLoadingCounts(false);
    });
  }, [open, orgId]);

  if (!open) return null;

  const nameMatches = confirmText === principalName;

  const handleDelete = async () => {
    if (!nameMatches) return;
    setIsDeleting(true);
    try {
      await onConfirmDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isDeleting ? onCancel : undefined} />
      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div
            key="step1"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md rounded-xl border border-red-500/30 bg-card p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  Delete {principalName}?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  This will permanently delete this principal and{" "}
                  <span className="font-semibold text-red-400">ALL</span> associated
                  data including projects, budgets, bills, messages, and team
                  assignments. This action cannot be undone.
                </p>
              </div>
            </div>

            {loadingCounts ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background/50 p-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading data summary...</span>
              </div>
            ) : counts ? (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                  Data to be deleted
                </p>
                <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <span className="text-muted-foreground">Projects</span>
                  <span className="font-medium text-foreground">{counts.projects}</span>
                  <span className="text-muted-foreground">Budget records</span>
                  <span className="font-medium text-foreground">{counts.budgets}</span>
                  <span className="text-muted-foreground">Bills</span>
                  <span className="font-medium text-foreground">{counts.bills}</span>
                  <span className="text-muted-foreground">Messages</span>
                  <span className="font-medium text-foreground">{counts.messages}</span>
                  <span className="text-muted-foreground">Team members</span>
                  <span className="font-medium text-foreground">{counts.members}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={loadingCounts}
                className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
              >
                Continue to verification
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md rounded-xl border border-red-500/30 bg-card p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-500/10 p-2">
                <Trash2 className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  Confirm deletion
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  To confirm deletion, type the principal name exactly as shown below:
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-background/50 px-4 py-3">
              <code className="text-sm font-semibold text-foreground">{principalName}</code>
            </div>

            <div className="mt-4">
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type the principal name..."
                autoFocus
                disabled={isDeleting}
                className={
                  confirmText.length > 0 && !nameMatches
                    ? "border-red-500/50 focus:ring-red-500/30"
                    : nameMatches
                    ? "border-emerald-500/50 focus:ring-emerald-500/30"
                    : ""
                }
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!nameMatches || isDeleting}
              >
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete permanently
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
