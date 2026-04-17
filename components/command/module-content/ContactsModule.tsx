"use client";

/**
 * Contacts module — global directory of every person across a principal's
 * projects and global (non-project) contacts. Search, filter chips, and
 * detail view live inside the module; cross-module links use
 * openModuleAt('projects', ...) to close the overlay and open Projects.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, Mail, Phone, User, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";
import { useActionGuard } from "@/lib/use-action-guard";
import {
  fetchAllContacts,
  createGlobalContact,
  CONTACT_CATEGORIES,
  type Contact,
  type ContactCategory,
  type CreateGlobalContactInput,
} from "@/lib/contacts-service";
import { useCommand } from "@/components/command/CommandContext";

type FilterChip = "all" | "personnel" | "subcontractor" | "global";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 55%, 35%)`;
}

export function ContactsModule() {
  const router = useRouter();
  const { orgId } = useEffectiveOrgId();
  const { isStaff } = useRole();
  const { blocked, guardClick } = useActionGuard();
  const { push, pop, navStack, close } = useCommand();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<FilterChip>("all");
  const [category, setCategory] = useState<ContactCategory | "">("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    fetchAllContacts(orgId)
      .then((rows) => setContacts(rows))
      .finally(() => setLoading(false));
  }, [orgId]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (chip === "personnel" && c.contact_type !== "personnel") return false;
      if (chip === "subcontractor" && c.contact_type !== "subcontractor") return false;
      if (chip === "global" && !c.is_global) return false;
      if (category && c.contact_category !== category) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !(c.email && c.email.toLowerCase().includes(q)) &&
          !(c.company_name && c.company_name.toLowerCase().includes(q)) &&
          !(c.role && c.role.toLowerCase().includes(q)) &&
          !(c.trade && c.trade.toLowerCase().includes(q))
        )
          return false;
      }
      return true;
    });
  }, [contacts, chip, category, query]);

  const selected = selectedId ? contacts.find((c) => c.id === selectedId) : null;

  async function handleCreate(input: CreateGlobalContactInput) {
    if (!orgId) return;
    const res = await createGlobalContact(orgId, input);
    if (res.success) {
      setShowAddModal(false);
      const rows = await fetchAllContacts(orgId);
      setContacts(rows);
    }
  }

  function openDetail(id: string) {
    setSelectedId(id);
    push({ path: `/contacts/${id}`, label: "Contact" });
  }

  function closeDetail() {
    setSelectedId(null);
    pop();
  }

  // Keep the overlay back-button wired to our internal close
  useEffect(() => {
    // If the overlay popped our entry (user hit back button), sync state.
    if (navStack.length === 0 && selectedId) {
      setSelectedId(null);
    }
  }, [navStack, selectedId]);

  function handleOpenAsset(assetId: string) {
    // Cross-module: close the overlay and route to the asset detail.
    close();
    router.push(`/assets/${assetId}`);
  }

  return (
    <div className="h-full w-full">
      {!selected ? (
        <ListView
          loading={loading}
          filtered={filtered}
          query={query}
          setQuery={setQuery}
          chip={chip}
          setChip={setChip}
          category={category}
          setCategory={setCategory}
          openDetail={openDetail}
          isStaff={isStaff}
          blocked={blocked}
          onAdd={() => setShowAddModal(true)}
        />
      ) : (
        <DetailView
          contact={selected}
          onBack={closeDetail}
          onOpenAsset={handleOpenAsset}
        />
      )}

      {showAddModal && (
        <AddGlobalContactModal
          onClose={() => setShowAddModal(false)}
          onSubmit={guardClick(handleCreate)}
          blocked={blocked}
        />
      )}
    </div>
  );
}

// ============================================
// List view
// ============================================

function ListView({
  loading,
  filtered,
  query,
  setQuery,
  chip,
  setChip,
  category,
  setCategory,
  openDetail,
  isStaff,
  blocked,
  onAdd,
}: {
  loading: boolean;
  filtered: Contact[];
  query: string;
  setQuery: (v: string) => void;
  chip: FilterChip;
  setChip: (v: FilterChip) => void;
  category: ContactCategory | "";
  setCategory: (v: ContactCategory | "") => void;
  openDetail: (id: string) => void;
  isStaff: boolean;
  blocked: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header controls */}
      <div className="border-b border-white/5 bg-black/40 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, company, email…"
              className="pl-9 focus-visible:ring-emerald-400/60"
            />
          </div>
          {isStaff && (
            <Button
              variant="default"
              size="sm"
              onClick={onAdd}
              disabled={blocked}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add global contact</span>
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["all", "personnel", "subcontractor", "global"] as FilterChip[]).map((c) => (
            <button
              key={c}
              onClick={() => setChip(c)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium transition " +
                (chip === c
                  ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
                  : "bg-white/5 text-white/60 hover:bg-white/10")
              }
            >
              {c === "all" ? "All" : c === "global" ? "Global" : c === "personnel" ? "Personnel" : "Subcontractors"}
            </button>
          ))}
          <select
            value={category}
            onChange={(e) => setCategory((e.target.value || "") as ContactCategory | "")}
            className="ml-auto rounded-lg border border-white/10 bg-black/60 px-2 py-1 text-xs text-white"
          >
            <option value="">All categories</option>
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-white/50">Loading contacts…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/50">No contacts match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openDetail(c.id)}
                className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-emerald-400/40 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{ background: hashColor(c.name) }}
                    aria-hidden
                  >
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-white">{c.name}</p>
                      {c.is_global && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300 ring-1 ring-emerald-400/30">
                          Global
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-white/60">
                      {c.role || c.trade || (c.contact_category ? CONTACT_CATEGORIES.find((cc) => cc.value === c.contact_category)?.label : "Contact")}
                    </p>
                    {c.linkedAssets[0] && (
                      <p className="mt-1 truncate text-[11px] text-white/50">
                        <Building2 className="mr-1 inline h-3 w-3" aria-hidden />
                        {c.linkedAssets[0].assetName}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Detail view
// ============================================

function DetailView({
  contact,
  onBack,
  onOpenAsset,
}: {
  contact: Contact;
  onBack: () => void;
  onOpenAsset: (assetId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
          ← Back to list
        </Button>

        <div className="flex items-start gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ background: hashColor(contact.name) }}
            aria-hidden
          >
            {initials(contact.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold text-white">{contact.name}</h3>
            <p className="text-sm text-white/60">
              {contact.role || contact.trade || "Contact"}
              {contact.company_name ? ` · ${contact.company_name}` : ""}
            </p>
            {contact.contact_category && (
              <p className="mt-1 text-xs text-white/50">
                {CONTACT_CATEGORIES.find((c) => c.value === contact.contact_category)?.label}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {contact.email && (
            <Card className="border-white/10 bg-white/[0.02]">
              <CardContent className="flex items-center gap-3 p-3">
                <Mail className="h-4 w-4 text-emerald-400" aria-hidden />
                <a
                  href={`mailto:${contact.email}`}
                  className="truncate text-sm text-white hover:text-emerald-300"
                >
                  {contact.email}
                </a>
              </CardContent>
            </Card>
          )}
          {contact.phone && (
            <Card className="border-white/10 bg-white/[0.02]">
              <CardContent className="flex items-center gap-3 p-3">
                <Phone className="h-4 w-4 text-emerald-400" aria-hidden />
                <a
                  href={`tel:${contact.phone}`}
                  className="truncate text-sm text-white hover:text-emerald-300"
                >
                  {contact.phone}
                </a>
              </CardContent>
            </Card>
          )}
        </div>

        {contact.notes && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/80">
            {contact.notes}
          </div>
        )}

        {contact.linkedAssets.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-white/50">
              Linked projects
            </p>
            <div className="space-y-2">
              {contact.linkedAssets.map((la) => (
                <button
                  key={la.assetId}
                  onClick={() => onOpenAsset(la.assetId)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left text-sm text-white transition hover:border-emerald-400/40 hover:bg-white/[0.04]"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-emerald-400" aria-hidden />
                    {la.assetName}
                  </span>
                  <span className="text-xs text-emerald-300">Open in Projects →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// Add Global Contact modal
// ============================================

function AddGlobalContactModal({
  onClose,
  onSubmit,
  blocked,
}: {
  onClose: () => void;
  onSubmit: (input: CreateGlobalContactInput) => void;
  blocked: boolean;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<ContactCategory>("other");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    onSubmit({
      name: name.trim(),
      role: role.trim() || undefined,
      company_name: company.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      contact_category: category,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-black p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-base font-semibold text-white">
            <User className="h-4 w-4 text-emerald-400" />
            Add Global Contact
          </h4>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <Input placeholder="Name *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Role / title" value={role} onChange={(e) => setRole(e.target.value)} />
          <Input placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ContactCategory)}
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
          >
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
            rows={3}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || blocked || !name.trim()}>
            {saving ? "Saving…" : "Create contact"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ContactsModule;
