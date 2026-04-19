"use client";

/**
 * ClientPicker — overlay-friendly client/principal selector.
 *
 * Extracted from `components/admin/shared/GlobalClientBanner.tsx` so the
 * Daily Brief workspace can let staff switch which client they're working
 * on without leaving the command overlay. Backed by the same hooks
 * (useActivePrincipal / useUserAssignments) and same data source
 * (fetchClientProfiles), so changes here also drive the global banner.
 *
 * Behavior:
 *   - Admins see all client profiles plus an "All Principals" entry.
 *   - Non-admin staff (manager/viewer) see only their assigned profiles
 *     and auto-select the only assignment when there is exactly one.
 *   - Principals (executive/delegate) don't render anything — the parent
 *     should not mount this component for them.
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  useActivePrincipal,
  useUserAssignments,
} from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";
import { fetchClientProfiles, type ClientProfile } from "@/lib/client-service";

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  coral: "bg-orange-500",
  pink: "bg-pink-500",
  green: "bg-emerald-500",
};

export function ClientPicker() {
  const { activePrincipal, setActivePrincipal, clearActivePrincipal } =
    useActivePrincipal();
  const { isAdmin, isStaff, isViewer } = useRole();
  const { assignedOrgIds } = useUserAssignments();
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const canSee = isAdmin || isStaff || isViewer;

  useEffect(() => {
    if (!canSee) return;
    fetchClientProfiles().then((all) => {
      if (isAdmin) {
        setProfiles(all);
      } else {
        const filtered = all.filter((p) =>
          assignedOrgIds.includes(p.organization_id)
        );
        setProfiles(filtered);
        // Auto-select the only assigned principal for non-admin staff.
        if (filtered.length === 1 && !activePrincipal) {
          setActivePrincipal({
            orgId: filtered[0].organization_id,
            displayName: filtered[0].display_name,
            accentColor: filtered[0].accent_color,
          });
        }
      }
    });
  }, [canSee, isAdmin, assignedOrgIds, activePrincipal, setActivePrincipal]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  if (!canSee) return null;

  // Non-admin with a single assignment: no dropdown, just a static label.
  const singleAssignment = !isAdmin && profiles.length <= 1;

  const dotClass = activePrincipal
    ? ACCENT_DOT[activePrincipal.accentColor] || ACCENT_DOT.amber
    : "";

  if (singleAssignment) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {activePrincipal && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        )}
        <span>
          Client:{" "}
          <span className="font-semibold text-foreground">
            {activePrincipal ? activePrincipal.displayName : "—"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
      >
        {activePrincipal && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        )}
        <span className="text-muted-foreground">Client:</span>
        <span className="font-medium">
          {activePrincipal ? activePrincipal.displayName : "All Principals"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 max-h-72 min-w-[240px] overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                clearActivePrincipal();
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
                !activePrincipal
                  ? "font-medium text-primary"
                  : "text-foreground"
              }`}
            >
              All Principals
            </button>
          )}
          {profiles.map((p) => {
            const selected = activePrincipal?.orgId === p.organization_id;
            const dot = ACCENT_DOT[p.accent_color] || ACCENT_DOT.amber;
            return (
              <button
                key={p.organization_id}
                type="button"
                onClick={() => {
                  setActivePrincipal({
                    orgId: p.organization_id,
                    displayName: p.display_name,
                    accentColor: p.accent_color,
                  });
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
                  selected ? "font-medium text-primary" : "text-foreground"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                {p.display_name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
