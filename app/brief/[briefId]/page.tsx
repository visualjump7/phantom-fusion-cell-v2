"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Loader2,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BriefReaderView } from "@/components/brief/BriefReaderView";
import {
  fetchBrief,
  fetchBriefs,
  fetchCashFlowData,
  fetchUpcomingBillsData,
  fetchProjectsSnapshot,
  fetchPendingDecisions,
  Brief,
} from "@/lib/brief-service";
import { useEffectiveOrgId } from "@/lib/use-active-principal";

export default function BriefDetailPage() {
  const params = useParams();
  const briefId = params.briefId as string;
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [prevBriefId, setPrevBriefId] = useState<string | null>(null);
  const [nextBriefId, setNextBriefId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const b = await fetchBrief(briefId);
      setBrief(b);

      if (b && b.organization_id) {
        const [cashflow, bills7, bills14, bills30, projects, decisions] =
          await Promise.all([
            fetchCashFlowData(b.organization_id),
            fetchUpcomingBillsData(b.organization_id, 7),
            fetchUpcomingBillsData(b.organization_id, 14),
            fetchUpcomingBillsData(b.organization_id, 30),
            fetchProjectsSnapshot(b.organization_id),
            fetchPendingDecisions(b.organization_id),
          ]);
        setLiveData({
          cashflow,
          bills_7: bills7,
          bills_14: bills14,
          bills_30: bills30,
          projects,
          decisions,
        });

        // Load adjacent briefs for navigation
        const allBriefs = await fetchBriefs(b.organization_id, "published");
        const currentIdx = allBriefs.findIndex((ab) => ab.id === briefId);
        if (currentIdx > 0) setNextBriefId(allBriefs[currentIdx - 1].id);
        else setNextBriefId(null);
        if (currentIdx < allBriefs.length - 1) setPrevBriefId(allBriefs[currentIdx + 1].id);
        else setPrevBriefId(null);
      }
      setIsLoading(false);
    }
    load();
  }, [briefId]);

  if (orgLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-[680px] px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">Brief not found</p>
          <Link
            href="/brief"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            Back to latest brief
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-[680px] px-4 py-10 sm:px-6"
      >
        <Link
          href="/brief/history"
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All briefs
        </Link>

        <BriefReaderView brief={brief} liveData={liveData} />

        {/* Navigation */}
        <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
          {prevBriefId ? (
            <Link
              href={`/brief/${prevBriefId}`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ChevronLeft className="h-3 w-3" />
              Previous Brief
            </Link>
          ) : (
            <span />
          )}
          {nextBriefId ? (
            <Link
              href={`/brief/${nextBriefId}`}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Next Brief
              <ChevronRight className="h-3 w-3" />
            </Link>
          ) : (
            <span />
          )}
        </div>
      </motion.main>
    </div>
  );
}
