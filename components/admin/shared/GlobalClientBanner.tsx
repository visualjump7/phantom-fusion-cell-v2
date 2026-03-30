"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";
import { useActivePrincipal, useUserAssignments } from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";
import { fetchClientProfiles, ClientProfile } from "@/lib/client-service";

const ACCENT_DOT: Record<string, string> = {
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  teal: "bg-teal-500",
  purple: "bg-purple-500",
  coral: "bg-orange-500",
  pink: "bg-pink-500",
  green: "bg-emerald-500",
};

const ACCENT_BORDER: Record<string, string> = {
  amber: "border-amber-500/50",
  blue: "border-blue-500/50",
  teal: "border-teal-500/50",
  purple: "border-purple-500/50",
  coral: "border-orange-500/50",
  pink: "border-pink-500/50",
  green: "border-emerald-500/50",
};

export function GlobalClientBanner() {
  const { activePrincipal, setActivePrincipal, clearActivePrincipal } = useActivePrincipal();
  const { isAdmin, isStaff, isViewer } = useRole();
  const { assignedOrgIds } = useUserAssignments();
  const [profiles, setProfiles] = useState<ClientProfile[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const showBanner = isAdmin || isStaff || isViewer;

  useEffect(() => {
    if (!showBanner) return;
    fetchClientProfiles().then((all) => {
      if (isAdmin) {
        setProfiles(all);
      } else {
        const filtered = all.filter((p) => assignedOrgIds.includes(p.organization_id));
        setProfiles(filtered);

        // Auto-select the only assigned principal for non-admin users
        if (!isAdmin && filtered.length === 1 && !activePrincipal) {
          setActivePrincipal({
            orgId: filtered[0].organization_id,
            displayName: filtered[0].display_name,
            accentColor: filtered[0].accent_color,
          });
        }
      }
    });
  }, [showBanner, isAdmin, assignedOrgIds, activePrincipal, setActivePrincipal]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [dropdownOpen]);

  if (!showBanner) return null;

  const dotClass = activePrincipal
    ? ACCENT_DOT[activePrincipal.accentColor] || ACCENT_DOT.amber
    : "";
  const borderClass = activePrincipal
    ? ACCENT_BORDER[activePrincipal.accentColor] || ACCENT_BORDER.amber
    : "border-border";

  // Viewers with a single assignment: static label, no dropdown
  const singleAssignment = !isAdmin && profiles.length <= 1;

  return (
    <div
      className={`flex items-center justify-between border-b ${borderClass} bg-card/80 px-4 py-2 sm:px-6`}
    >
      <div className="relative flex items-center gap-2" ref={ref}>
        {activePrincipal && (
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
        )}

        {singleAssignment ? (
          <span className="text-sm text-muted-foreground">
            Viewing:{" "}
            <span className="font-semibold text-foreground">
              {activePrincipal ? activePrincipal.displayName : "—"}
            </span>
          </span>
        ) : (
          <>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>
                Viewing:{" "}
                <span className="font-semibold text-foreground">
                  {activePrincipal ? activePrincipal.displayName : "All Principals"}
                </span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] rounded-lg border border-border bg-card py-1 shadow-lg">
                {isAdmin && (
                  <button
                    onClick={() => { clearActivePrincipal(); setDropdownOpen(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
                      !activePrincipal ? "text-primary font-medium" : "text-foreground"
                    }`}
                  >
                    All Principals
                  </button>
                )}
                {profiles.map((p) => {
                  const isSelected = activePrincipal?.orgId === p.organization_id;
                  const dot = ACCENT_DOT[p.accent_color] || ACCENT_DOT.amber;
                  return (
                    <button
                      key={p.organization_id}
                      onClick={() => {
                        setActivePrincipal({
                          orgId: p.organization_id,
                          displayName: p.display_name,
                          accentColor: p.accent_color,
                        });
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted ${
                        isSelected ? "text-primary font-medium" : "text-foreground"
                      }`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      {p.display_name}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {activePrincipal && isAdmin && (
        <button
          onClick={() => clearActivePrincipal()}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
