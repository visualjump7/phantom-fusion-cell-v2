"use client";

/**
 * CreateActionFAB — floating "+" button on /command.
 *
 * Mounts bottom-right on the orbital Command page. Clicking the button
 * opens a compact action menu that routes the user to the relevant
 * create flow: New Alert, New Project, New Trip, etc. Each target page
 * reads a ?create=1 / ?compose=1 query param and auto-opens its existing
 * create/compose modal on mount (handlers live in each page — added in
 * the same changeset as this component).
 *
 * Hidden automatically when a module overlay is active (we don't want a
 * FAB floating over the focused panel) and when the user has no actions
 * available (e.g. delegates).
 *
 * Role filtering mirrors the creation affordances that already exist on
 * each target page:
 *   - staff (admin / manager) — Alert, Project, Trip, Contact
 *   - executive               — Trip
 *   - delegate                — (no actions; FAB hidden)
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  X,
  MessageSquare,
  Building2,
  Plane,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRole } from "@/lib/use-role";
import { useCommand } from "./CommandContext";

type Audience = "staff" | "executive";

interface CreateAction {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
  roles: Audience[];
}

const ACTIONS: CreateAction[] = [
  {
    key: "alert",
    label: "New Alert",
    description: "Send a decision or update to a principal.",
    icon: MessageSquare,
    route: "/admin/messages?compose=1",
    roles: ["staff"],
  },
  {
    key: "project",
    label: "New Project",
    description: "Add a holding to the directory.",
    icon: Building2,
    route: "/assets?create=1",
    roles: ["staff"],
  },
  {
    key: "trip",
    label: "New Trip",
    description: "Plan a new travel itinerary.",
    icon: Plane,
    route: "/calendar?create=1",
    roles: ["staff", "executive"],
  },
  // Note: New Contact would live here but contacts only have a Command
  // module (no standalone /contacts route). Re-add once contacts get a
  // standalone page or once we support opening modules with preset state.
];

export function CreateActionFAB() {
  const router = useRouter();
  const { isStaff, isExecutive, isDelegate } = useRole();
  const { activeModule } = useCommand();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // Hide while a module overlay is focused — the FAB belongs to the
  // orbital view, not to the individual modules.
  if (activeModule) return null;
  // Delegates have no create rights anywhere we surface here.
  if (isDelegate) return null;

  const visible = ACTIONS.filter((a) => {
    if (isStaff && a.roles.includes("staff")) return true;
    if (isExecutive && a.roles.includes("executive")) return true;
    return false;
  });

  if (visible.length === 0) return null;

  function go(route: string) {
    setOpen(false);
    router.push(route);
  }

  return (
    <div
      ref={wrapperRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 md:bottom-8 md:right-8"
    >
      {open && (
        <div
          role="menu"
          className="w-72 overflow-hidden rounded-xl border border-emerald-400/20 bg-neutral-900/95 shadow-2xl backdrop-blur-md"
        >
          <div className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Create new
          </div>
          {visible.map((action) => (
            <button
              key={action.key}
              role="menuitem"
              onClick={() => go(action.route)}
              className="flex w-full items-start gap-3 border-t border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-300">
                <action.icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-white">
                  {action.label}
                </span>
                <span className="mt-0.5 block text-xs text-white/50">
                  {action.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close create menu" : "Create something new"}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_30px_rgba(74,222,128,0.35)] transition-all",
          "bg-emerald-500 hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          open && "rotate-45 bg-emerald-400"
        )}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}

export default CreateActionFAB;
