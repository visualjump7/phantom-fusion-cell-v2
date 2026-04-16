"use client";

/**
 * Unified calendar module — merges ICS-sourced external events with system
 * events (cash flow / decisions / travel) in a read-only month grid.
 *
 * Admin-only controls:
 *   - Manage calendars gear icon opens a side panel to add/edit/delete
 *     ICS sources per principal (guarded by useActionGuard).
 *   - Stale-sync banner is admin-only.
 *
 * Principal view is pure read-only: tap a day to see its events; tap an
 * event pill to see details / jump to the source module for system events.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings2,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";
import { usePreview } from "@/lib/preview-context";
import { useActionGuard } from "@/lib/use-action-guard";
import {
  fetchAllEvents,
  fetchCalendarSources,
  createCalendarSource,
  updateCalendarSource,
  deleteCalendarSource,
  type ExternalEvent,
} from "@/lib/calendar-service";
import type { SystemEvent } from "@/lib/calendar-system";

// Syncs run server-side so node-ical's Node built-ins never end up in the
// browser bundle. The API route lives at /api/calendar/sync-source.
async function syncSourceViaApi(sourceId: string): Promise<{
  success: boolean;
  error?: string;
  eventsUpserted?: number;
}> {
  try {
    const res = await fetch("/api/calendar/sync-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId }),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
import { useNucleus } from "@/components/nucleus/NucleusContext";

type AnyEvent =
  | { kind: "external"; e: ExternalEvent }
  | { kind: "system"; e: SystemEvent };

function monthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay()); // Sunday-aligned
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      row.push(dt);
    }
    weeks.push(row);
  }
  return weeks;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function CalendarModule() {
  const router = useRouter();
  const { orgId } = useEffectiveOrgId();
  const { userId, isStaff } = useRole();
  const preview = usePreview();
  const { blocked, guardClick } = useActionGuard();
  const { close } = useNucleus();

  const principalId = preview.active ? preview.principalId : userId;

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<AnyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenSources, setHiddenSources] = useState<Set<string>>(new Set());
  const [systemHidden, setSystemHidden] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [sources, setSources] = useState<any[]>([]);

  const weeks = useMemo(
    () => monthMatrix(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  const loadEvents = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const start = weeks[0][0];
    const end = weeks[weeks.length - 1][6];
    end.setHours(23, 59, 59);
    const { external, system } = await fetchAllEvents(orgId, principalId, start, end);
    setEvents([
      ...external.map((e) => ({ kind: "external" as const, e })),
      ...system.map((e) => ({ kind: "system" as const, e })),
    ]);
    setLoading(false);
  }, [orgId, principalId, weeks]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!orgId) return;
    fetchCalendarSources(orgId, principalId).then(setSources);
  }, [orgId, principalId, manageOpen]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, AnyEvent[]>();
    for (const ev of events) {
      if (ev.kind === "external" && hiddenSources.has(ev.e.sourceId)) continue;
      if (ev.kind === "system" && systemHidden) continue;
      const key = ev.e.start.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    for (const list of map.values()) list.sort((a, b) => +a.e.start - +b.e.start);
    return map;
  }, [events, hiddenSources, systemHidden]);

  const externalSourceChips = useMemo(() => {
    const seen = new Map<string, { label: string; color: string }>();
    for (const ev of events) {
      if (ev.kind !== "external") continue;
      if (!seen.has(ev.e.sourceId)) {
        seen.set(ev.e.sourceId, { label: ev.e.sourceLabel, color: ev.e.sourceColor });
      }
    }
    return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }));
  }, [events]);

  function prevMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  }

  function handleEventJump(ev: SystemEvent) {
    close();
    router.push(ev.href);
  }

  const staleBanner = useMemo(() => {
    if (!isStaff) return null;
    const now = Date.now();
    const stale = sources.find(
      (s: any) =>
        s.last_sync_status &&
        s.last_sync_status.startsWith("error:") &&
        s.last_synced_at &&
        now - new Date(s.last_synced_at).getTime() > 2 * 60 * 60 * 1000
    );
    return stale ?? null;
  }, [sources, isStaff]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold text-white">{fmtMonth(cursor)}</h3>
          <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {isStaff && !preview.active && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setManageOpen(true)}
            className="gap-1.5"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage calendars
          </Button>
        )}
      </div>

      {/* Source filter chips */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-4 py-2">
        <button
          onClick={() => setSystemHidden((v) => !v)}
          className={
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition " +
            (systemHidden
              ? "bg-white/5 text-white/50"
              : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40")
          }
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
          System
        </button>
        {externalSourceChips.map((s) => (
          <button
            key={s.id}
            onClick={() =>
              setHiddenSources((prev) => {
                const next = new Set(prev);
                if (next.has(s.id)) next.delete(s.id);
                else next.add(s.id);
                return next;
              })
            }
            className={
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition " +
              (hiddenSources.has(s.id)
                ? "bg-white/5 text-white/50"
                : "bg-white/10 text-white ring-1 ring-white/20")
            }
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </button>
        ))}
      </div>

      {staleBanner && (
        <button
          onClick={() => setManageOpen(true)}
          className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-300"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <strong>{staleBanner.label}</strong> hasn&apos;t synced successfully in over 2 hours. Check the share link.
          </span>
        </button>
      )}

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-white/50">Loading calendar…</p>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 text-[11px] uppercase tracking-wide text-white/40">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="px-2 py-1 text-left">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {weeks.flat().map((d) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const dayEvents = eventsByDay.get(d.toDateString()) ?? [];
                const isToday = sameDay(d, new Date());
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelectedDay(d)}
                    className={
                      "flex min-h-[86px] flex-col items-stretch rounded-lg border p-1 text-left transition " +
                      (inMonth
                        ? "border-white/10 bg-white/[0.02] hover:border-emerald-400/40"
                        : "border-white/5 bg-white/[0.01] opacity-50") +
                      (isToday ? " ring-1 ring-emerald-400/60" : "")
                    }
                  >
                    <span className="mb-1 text-[11px] font-medium text-white/70">
                      {d.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={`${ev.kind}-${ev.e.id}`}
                          className="truncate rounded px-1 py-0.5 text-[10px]"
                          style={{
                            background:
                              ev.kind === "external"
                                ? `${ev.e.sourceColor}22`
                                : `${ev.e.color}22`,
                            color:
                              ev.kind === "external"
                                ? ev.e.sourceColor
                                : ev.e.color,
                          }}
                        >
                          {ev.e.title}
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-white/40">
                          +{dayEvents.length - 3} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {selectedDay && (
        <DayDetailSheet
          day={selectedDay}
          events={eventsByDay.get(selectedDay.toDateString()) ?? []}
          onClose={() => setSelectedDay(null)}
          onJump={handleEventJump}
        />
      )}

      {manageOpen && (
        <ManageCalendarsPanel
          orgId={orgId!}
          principalId={principalId}
          sources={sources}
          onClose={() => setManageOpen(false)}
          onRefresh={() => {
            if (orgId) fetchCalendarSources(orgId, principalId).then(setSources);
            loadEvents();
          }}
          blocked={blocked}
          guardClick={guardClick}
        />
      )}
    </div>
  );
}

// ============================================
// Day detail
// ============================================

function DayDetailSheet({
  day,
  events,
  onClose,
  onJump,
}: {
  day: Date;
  events: AnyEvent[];
  onClose: () => void;
  onJump: (ev: SystemEvent) => void;
}) {
  return (
    <div className="fixed inset-0 z-[65] flex items-end bg-black/60 md:items-center md:justify-center">
      <div className="w-full max-w-md rounded-t-2xl border border-emerald-400/30 bg-black p-5 md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-base font-semibold text-white">
            {day.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h4>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/50">No events on this day.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li
                key={`${ev.kind}-${ev.e.id}`}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        ev.kind === "external" ? ev.e.sourceColor : ev.e.color,
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{ev.e.title}</p>
                    <p className="mt-0.5 text-xs text-white/50">
                      {ev.kind === "external"
                        ? ev.e.isAllDay
                          ? "All day"
                          : `${fmtTime(ev.e.start)}${ev.e.end ? ` – ${fmtTime(ev.e.end)}` : ""}`
                        : `${fmtTime(ev.e.start)}`}
                      {ev.kind === "external" && ` · ${ev.e.sourceLabel}`}
                    </p>
                    {ev.kind === "external" && ev.e.location && (
                      <p className="mt-1 text-xs text-white/60">📍 {ev.e.location}</p>
                    )}
                    {ev.kind === "external" && ev.e.description && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-white/60">
                        {ev.e.description}
                      </p>
                    )}
                    {ev.kind === "system" && (
                      <button
                        onClick={() => onJump(ev.e)}
                        className="mt-2 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                      >
                        Open in {ev.e.sourceKind === "cashflow" ? "Cash Flow" : ev.e.sourceKind === "decision" ? "Comms" : "Travel"} →
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============================================
// Manage Calendars panel (admin only)
// ============================================

function ManageCalendarsPanel({
  orgId,
  principalId,
  sources,
  onClose,
  onRefresh,
  blocked,
  guardClick,
}: {
  orgId: string;
  principalId: string | null;
  sources: any[];
  onClose: () => void;
  onRefresh: () => void;
  blocked: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  guardClick: <T extends (...args: any[]) => any>(handler: T) => T;
}) {
  const [showAdd, setShowAdd] = useState(false);

  async function handleToggle(id: string, next: boolean) {
    await updateCalendarSource(id, { is_active: next });
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this calendar source? Cached events will be removed.")) return;
    await deleteCalendarSource(id);
    onRefresh();
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-stretch bg-black/70">
      <div className="ml-auto flex h-full w-full max-w-md flex-col bg-black ring-1 ring-emerald-400/30">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h4 className="text-base font-semibold text-white">Manage calendars</h4>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            disabled={blocked}
            className="mb-4 w-full gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add calendar
          </Button>

          {sources.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/50">
              No calendars configured. Add an ICS share link to start syncing.
            </p>
          ) : (
            <ul className="space-y-2">
              {sources.map((s) => (
                <Card key={s.id} className="border-white/10 bg-white/[0.02]">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: s.color }}
                            aria-hidden
                          />
                          <p className="truncate text-sm font-medium text-white">{s.label}</p>
                        </div>
                        <p className="mt-0.5 text-[11px] text-white/50">
                          {s.provider_hint || "other"} ·{" "}
                          {s.last_synced_at
                            ? `synced ${new Date(s.last_synced_at).toLocaleString()}`
                            : "never synced"}
                        </p>
                        {s.last_sync_status && s.last_sync_status.startsWith("error:") && (
                          <p className="mt-1 text-[11px] text-amber-300">
                            {s.last_sync_status}
                          </p>
                        )}
                      </div>
                      <label className="flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={!!s.is_active}
                          disabled={blocked}
                          onChange={(e) => guardClick(() => handleToggle(s.id, e.target.checked))()}
                        />
                        <span
                          className={
                            "relative inline-flex h-5 w-9 items-center rounded-full transition " +
                            (s.is_active ? "bg-emerald-500/80" : "bg-white/20")
                          }
                        >
                          <span
                            className={
                              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition " +
                              (s.is_active ? "translate-x-5" : "translate-x-1")
                            }
                          />
                        </span>
                      </label>
                      <button
                        onClick={() => guardClick(() => handleDelete(s.id))()}
                        disabled={blocked}
                        className="text-white/50 hover:text-red-400 disabled:opacity-40"
                        aria-label="Delete calendar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </ul>
          )}
        </div>
        {showAdd && (
          <AddCalendarModal
            orgId={orgId}
            principalId={principalId}
            onClose={() => setShowAdd(false)}
            onSuccess={() => {
              setShowAdd(false);
              onRefresh();
            }}
            blocked={blocked}
          />
        )}
      </div>
    </div>
  );
}

function AddCalendarModal({
  orgId,
  principalId,
  onClose,
  onSuccess,
  blocked,
}: {
  orgId: string;
  principalId: string | null;
  onClose: () => void;
  onSuccess: () => void;
  blocked: boolean;
}) {
  const [label, setLabel] = useState("");
  const [provider, setProvider] = useState<"outlook" | "apple" | "google" | "exchange" | "other">("other");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState("#60A5FA");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const COLORS = [
    "#60A5FA",
    "#4ADE80",
    "#F59E0B",
    "#EF4444",
    "#A855F7",
    "#22D3EE",
    "#F97316",
    "#D946EF",
  ];

  async function save() {
    if (!label.trim() || !url.trim()) return;
    setError(null);
    setSaving(true);
    const create = await createCalendarSource({
      organization_id: orgId,
      principal_id: principalId,
      label: label.trim(),
      provider_hint: provider,
      ics_url: url.trim(),
      color,
    });
    if (!create.success || !create.id) {
      setError(create.error || "Failed to save calendar source.");
      setSaving(false);
      return;
    }
    const sync = await syncSourceViaApi(create.id);
    if (!sync.success) {
      setError(`Calendar saved but first sync failed: ${sync.error}. Check the URL and try again.`);
      setSaving(false);
      return;
    }
    setSaving(false);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-400/30 bg-black p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-base font-semibold text-white">Add calendar</h4>
          <button onClick={onClose} aria-label="Close" className="text-white/60 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <Input placeholder="Label (e.g., Work — Outlook)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
          >
            <option value="outlook">Outlook / Microsoft 365</option>
            <option value="apple">Apple Calendar</option>
            <option value="google">Google Calendar</option>
            <option value="exchange">Corporate Exchange</option>
            <option value="other">Other</option>
          </select>
          <textarea
            placeholder="ICS share URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white"
            rows={2}
          />
          <div>
            <p className="mb-1.5 text-xs font-medium text-white/60">Color</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={
                    "h-7 w-7 rounded-full ring-2 " +
                    (color === c ? "ring-white" : "ring-transparent")
                  }
                  style={{ background: c }}
                  aria-label={`Pick color ${c}`}
                />
              ))}
            </div>
          </div>

          <details className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-white/60">
            <summary className="cursor-pointer text-white/80">How do I get an ICS link?</summary>
            <ul className="mt-2 space-y-1.5 pl-4">
              <li><strong>Outlook:</strong> Settings → Calendar → Shared calendars → Publish a calendar → ICS link.</li>
              <li><strong>Apple:</strong> Calendar app → right-click the calendar → Share Calendar → Public → copy URL.</li>
              <li><strong>Google:</strong> Calendar settings → specific calendar → Integrate calendar → Secret address in iCal format.</li>
            </ul>
          </details>

          {error && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {error}
            </p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || blocked || !label.trim() || !url.trim()}>
            {saving ? "Syncing…" : "Save & sync"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CalendarModule;
