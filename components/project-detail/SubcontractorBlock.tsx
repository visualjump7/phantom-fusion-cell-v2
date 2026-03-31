"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building, Plus, MoreVertical, Pencil, Trash2, Mail, Phone,
  ShieldCheck, ShieldAlert, Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ProjectContact,
  getStatusColor,
  getTradeColor,
  deleteContact,
} from "@/lib/project-detail-service";
import { formatCurrency, cn } from "@/lib/utils";

interface SubcontractorBlockProps {
  blockId: string;
  orgId: string;
  contacts: ProjectContact[];
  onUpdate: () => void;
  onAdd: () => void;
  onEdit: (contact: ProjectContact) => void;
}

export function SubcontractorBlock({
  contacts,
  onUpdate,
  onAdd,
  onEdit,
}: SubcontractorBlockProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleDelete = async (contactId: string) => {
    await deleteContact(contactId);
    setMenuOpen(null);
    onUpdate();
  };

  const isInsuranceExpiring = (expiry: string | null): boolean => {
    if (!expiry) return false;
    const expiryDate = new Date(expiry);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow;
  };

  if (contacts.length === 0) {
    return (
      <div
        onClick={onAdd}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 transition-colors hover:border-primary/50 hover:bg-muted/20"
      >
        <Building className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          Add subcontractors and vendors
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {contacts.map((contact) => (
            <motion.div
              key={contact.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="relative rounded-lg border border-border bg-card p-4"
              style={{ minHeight: 180 }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">
                    {contact.company_name || contact.name}
                  </p>
                  {contact.trade && (
                    <Badge
                      variant="outline"
                      className={cn("mt-1 text-xs", getTradeColor(contact.trade))}
                    >
                      {contact.trade}
                    </Badge>
                  )}
                </div>

                {/* Three-dot menu */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpen(menuOpen === contact.id ? null : contact.id)
                    }
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpen === contact.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(null)}
                      />
                      <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-lg border border-border bg-card py-1 shadow-xl">
                        <button
                          onClick={() => {
                            setMenuOpen(null);
                            onEdit(contact);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Primary contact */}
              {contact.name && contact.company_name && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Contact: {contact.name}
                </p>
              )}

              <div className="mt-1 space-y-0.5">
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a
                    href={`tel:${contact.phone}`}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
                  >
                    <Phone className="h-3 w-3" />
                    {contact.phone}
                  </a>
                )}
              </div>

              {/* Contract info */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {contact.contract_value_cents != null && contact.contract_value_cents > 0 && (
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(contact.contract_value_cents / 100)}
                  </span>
                )}
                <Badge
                  variant="outline"
                  className={cn("text-xs", getStatusColor(contact.status))}
                >
                  {contact.status}
                </Badge>
              </div>

              {/* Dates */}
              {(contact.contract_start || contact.contract_end) && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {contact.contract_start &&
                    new Date(contact.contract_start).toLocaleDateString()}
                  {contact.contract_start && contact.contract_end && " \u2013 "}
                  {contact.contract_end &&
                    new Date(contact.contract_end).toLocaleDateString()}
                </div>
              )}

              {/* Insurance */}
              <div className="mt-2 flex items-center gap-1.5">
                {contact.insurance_on_file ? (
                  isInsuranceExpiring(contact.insurance_expiry) ? (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Insurance expiring soon
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Insurance on file
                    </span>
                  )
                ) : (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    No insurance on file
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Button variant="outline" size="sm" className="mt-3" onClick={onAdd}>
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add Subcontractor
      </Button>
    </div>
  );
}
