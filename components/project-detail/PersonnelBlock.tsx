"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Plus, MoreVertical, Pencil, Trash2, Mail, Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectContact, getStatusColor, deleteContact } from "@/lib/project-detail-service";
import { cn } from "@/lib/utils";

interface PersonnelBlockProps {
  blockId: string;
  orgId: string;
  contacts: ProjectContact[];
  onUpdate: () => void;
  onAdd: () => void;
  onEdit: (contact: ProjectContact) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-400",
  "bg-emerald-500/20 text-emerald-400",
  "bg-purple-500/20 text-purple-400",
  "bg-amber-500/20 text-amber-400",
  "bg-rose-500/20 text-rose-400",
  "bg-teal-500/20 text-teal-400",
  "bg-indigo-500/20 text-indigo-400",
  "bg-orange-500/20 text-orange-400",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function PersonnelBlock({
  contacts,
  onUpdate,
  onAdd,
  onEdit,
}: PersonnelBlockProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleDelete = async (contactId: string) => {
    await deleteContact(contactId);
    setMenuOpen(null);
    onUpdate();
  };

  if (contacts.length === 0) {
    return (
      <div
        onClick={onAdd}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-12 transition-colors hover:border-primary/50 hover:bg-muted/20"
      >
        <User className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          Add team members working on this project
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
              style={{ minHeight: 160 }}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    getAvatarColor(contact.name)
                  )}
                >
                  {getInitials(contact.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{contact.name}</p>
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

                  {contact.role && (
                    <p className="text-sm text-muted-foreground">{contact.role}</p>
                  )}
                  {contact.company && (
                    <p className="text-xs text-muted-foreground">{contact.company}</p>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getStatusColor(contact.status))}
                    >
                      {contact.status}
                    </Badge>
                  </div>

                  {/* Contact info */}
                  <div className="mt-2 space-y-0.5">
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
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Button variant="outline" size="sm" className="mt-3" onClick={onAdd}>
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add Person
      </Button>
    </div>
  );
}
