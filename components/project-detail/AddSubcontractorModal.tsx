"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ProjectContact,
  addContact,
  updateContact,
  CONTACT_STATUSES,
  COMMON_TRADES,
} from "@/lib/project-detail-service";
import { cn } from "@/lib/utils";

interface AddSubcontractorModalProps {
  open: boolean;
  blockId: string;
  orgId: string;
  editing?: ProjectContact | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AddSubcontractorModal({
  open,
  blockId,
  orgId,
  editing,
  onClose,
  onSaved,
}: AddSubcontractorModalProps) {
  const [companyName, setCompanyName] = useState(editing?.company_name || "");
  const [trade, setTrade] = useState(editing?.trade || "");
  const [tradeSearch, setTradeSearch] = useState(editing?.trade || "");
  const [showTradeSuggestions, setShowTradeSuggestions] = useState(false);
  const [contactName, setContactName] = useState(editing?.name || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [phone, setPhone] = useState(editing?.phone || "");
  const [contractValue, setContractValue] = useState(
    editing?.contract_value_cents ? String(editing.contract_value_cents / 100) : ""
  );
  const [contractStart, setContractStart] = useState(editing?.contract_start || "");
  const [contractEnd, setContractEnd] = useState(editing?.contract_end || "");
  const [licenseNumber, setLicenseNumber] = useState(editing?.license_number || "");
  const [insuranceOnFile, setInsuranceOnFile] = useState(editing?.insurance_on_file || false);
  const [insuranceExpiry, setInsuranceExpiry] = useState(editing?.insurance_expiry || "");
  const [status, setStatus] = useState(editing?.status || "active");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTrades = COMMON_TRADES.filter((t) =>
    t.toLowerCase().includes(tradeSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!trade.trim()) {
      setError("Trade/specialty is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const data: Partial<ProjectContact> = {
      contact_type: "subcontractor",
      name: contactName.trim() || companyName.trim(),
      company_name: companyName.trim(),
      trade: trade.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      contract_value_cents: contractValue ? Math.round(parseFloat(contractValue) * 100) : null,
      contract_start: contractStart || null,
      contract_end: contractEnd || null,
      license_number: licenseNumber.trim() || null,
      insurance_on_file: insuranceOnFile,
      insurance_expiry: insuranceOnFile && insuranceExpiry ? insuranceExpiry : null,
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
          className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {editing ? "Edit Subcontractor" : "Add Subcontractor"}
            </h2>
            <button onClick={onClose}>
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Company Name *</label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Trade with autocomplete */}
            <div className="relative">
              <label className="text-xs text-muted-foreground">Trade / Specialty *</label>
              <Input
                value={tradeSearch}
                onChange={(e) => {
                  setTradeSearch(e.target.value);
                  setTrade(e.target.value);
                  setShowTradeSuggestions(true);
                }}
                onFocus={() => setShowTradeSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTradeSuggestions(false), 200)}
                placeholder="e.g. Electrical, HVAC, Legal"
              />
              {showTradeSuggestions && filteredTrades.length > 0 && tradeSearch && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-32 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-xl">
                  {filteredTrades.map((t) => (
                    <button
                      key={t}
                      onMouseDown={() => {
                        setTrade(t);
                        setTradeSearch(t);
                        setShowTradeSuggestions(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-muted"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground">Primary Contact Name</label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
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
              <label className="text-xs text-muted-foreground">Contract Value ($)</label>
              <Input
                type="number"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Contract Start</label>
                <Input
                  type="date"
                  value={contractStart}
                  onChange={(e) => setContractStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Contract End</label>
                <Input
                  type="date"
                  value={contractEnd}
                  onChange={(e) => setContractEnd(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">License Number</label>
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
            </div>

            {/* Insurance toggle */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={insuranceOnFile}
                  onChange={(e) => setInsuranceOnFile(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm text-foreground">Insurance on file</span>
              </label>
              {insuranceOnFile && (
                <div>
                  <label className="text-xs text-muted-foreground">Insurance Expiry</label>
                  <Input
                    type="date"
                    value={insuranceExpiry}
                    onChange={(e) => setInsuranceExpiry(e.target.value)}
                  />
                </div>
              )}
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
              {editing ? "Save" : "Add Subcontractor"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
