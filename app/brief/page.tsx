"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, FileText, Calendar, Plus } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BriefReaderView } from "@/components/brief/BriefReaderView";
import {
  fetchBriefs,
  fetchLatestPublishedBrief,
  fetchCashFlowData,
  fetchUpcomingBillsData,
  fetchProjectsSnapshot,
  fetchPendingDecisions,
  fetchCalendarData,
  Brief,
} from "@/lib/brief-service";
import { useEffectiveOrgId } from "@/lib/use-active-principal";
import { useRole } from "@/lib/use-role";
import { useInsideCommand } from "@/components/command/CommandContext";

export default function BriefPage() {
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const { isStaff } = useRole();
  const embedded = useInsideCommand();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [previousBriefs, setPreviousBriefs] = useState<Brief[]>([]);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    async function load() {
      setIsLoading(true);
      const [latest, published] = await Promise.all([
        fetchLatestPublishedBrief(orgId!),
        fetchBriefs(orgId!, "published"),
      ]);
      setBrief(latest);
      // Exclude the latest from the "previous" list so it doesn't double-up.
      setPreviousBriefs(
        latest ? published.filter((b) => b.id !== latest.id) : published
      );

      if (latest) {
        // Only fetch calendar windows actually used by blocks on this brief.
        const calendarWindows = new Set<number>();
        for (const b of latest.blocks || []) {
          if (b.type === "calendar") {
            calendarWindows.add(Number(b.config?.days_ahead) || 7);
          }
        }

        const [cashflow, bills7, bills14, bills30, projects, decisions, ...calendarArr] =
          await Promise.all([
            fetchCashFlowData(orgId!),
            fetchUpcomingBillsData(orgId!, 7),
            fetchUpcomingBillsData(orgId!, 14),
            fetchUpcomingBillsData(orgId!, 30),
            fetchProjectsSnapshot(orgId!),
            fetchPendingDecisions(orgId!),
            ...Array.from(calendarWindows).map((d) =>
              fetchCalendarData(orgId!, d)
            ),
          ]);
        const calendarEntries = Array.from(calendarWindows).map(
          (d, i) => [`calendar_${d}`, calendarArr[i]] as const
        );
        setLiveData({
          cashflow,
          bills_7: bills7,
          bills_14: bills14,
          bills_30: bills30,
          projects,
          decisions,
          ...Object.fromEntries(calendarEntries),
        });
      }
      setIsLoading(false);
    }
    load();
  }, [orgId]);

  // Staff-only "+ New Brief" — routes to the admin compose flow for the
  // currently-scoped principal. Hidden for executives/delegates (they read
  // briefs, they don't compose them) and for staff with no active org.
  const showNewBriefButton = isStaff && !!orgId;
  const newBriefHref = orgId ? `/admin/client/${orgId}/briefs` : "#";

  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        {!embedded && <Navbar />}
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!embedded && <Navbar />}
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-[680px] px-4 py-10 sm:px-6"
      >
        {/* Header row — shown whenever we have staff-only create rights or
            when there's no latest brief to anchor the page (so the user
            still sees a title). */}
        {(showNewBriefButton || !brief) && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Daily Brief</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Today&apos;s overview from your Fusion Cell team
              </p>
            </div>
            {showNewBriefButton && (
              <Button asChild size="sm" className="gap-1.5">
                <Link href={newBriefHref}>
                  <Plus className="h-4 w-4" />
                  New Brief
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Latest brief body */}
        {brief ? (
          <BriefReaderView brief={brief} liveData={liveData} />
        ) : (
          <div className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-lg text-muted-foreground">No brief available</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {showNewBriefButton
                ? "Publish the first brief for this principal using the button above."
                : "Your Fusion Cell team has not published a brief yet."}
            </p>
          </div>
        )}

        {/* Inline list of previous briefs. Shown whenever there's more than
            the currently-displayed one so the user doesn't need to navigate
            away to find older briefs. */}
        {previousBriefs.length > 0 && (
          <section className="mt-12 border-t border-border pt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Previous briefs
              </h2>
              <span className="text-xs text-muted-foreground">
                {previousBriefs.length}{" "}
                {previousBriefs.length === 1 ? "brief" : "briefs"}
              </span>
            </div>
            <div className="space-y-2">
              {previousBriefs.map((b) => (
                <Link key={b.id} href={`/brief/${b.id}`}>
                  <Card className="group cursor-pointer border-border transition-colors hover:bg-muted/20">
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {b.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          {new Date(
                            b.brief_date + "T00:00:00"
                          ).toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </motion.main>
    </div>
  );
}
