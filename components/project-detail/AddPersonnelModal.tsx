"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProjectContact, addContact, updateContact, CONTACT_STATUSES } from "@/lib/project-detail-service";
import { cn } from "@/lib/utils";

interface AddPersonnelModalProps {
  open: boolean;
  blockId: string;
  orgId: string;
  editing?: ProjectContact | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPersonnelModal({
  open,
  blockId,
  orgId,
  editing,
  onClose,
  onSaved,
}: AddPersonnelModalProps) {
  const [name, setName] = useState(editing?.name || "");
  const [role, setRole] = useState(editing?.role || "");
  const [company, setCompany] = useState(editing?.company || "");
  const [department, setDepartment] = useState(editing?.department || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [phone, setPhone] = useState(editing?.phone || "");
  const [status, setStatus] = useState(editing?.status || "active");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!role.trim()) {
      setError("Role is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const data: Partial<ProjectContact> = {
      contact_type: "personnel",
      name: name.trim(),
      role: role.trim(),
      company: company.trim() || null,
      department: department.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      status: status as ProjectContact["status"],
      notes: notes.trim() || null,
    };

    let success: boolean;
    if (editing) {
      success = await updateContact(editing.id, data);
    } else {
      const result = await addContact(blockId, orgId, data);
      success = !!result;
    }

    setSaving(false);
    if (success) {
      onSaved();
      onClose();
    } else {
      setError("Failed to save. Please try again.");
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {editing ? "Edit Person" : "Add Person"}
            </h2>
            <button onClick={onClose}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Role *</label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Project Manager, Site Foreman"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Company</label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="mt-1 flex flex-wrap gap-2">
                {CONTACT_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value as ProjectContact["status"])}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      status === s.value
                        ? s.color
                        : "border-border text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save" : "Add Person"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
