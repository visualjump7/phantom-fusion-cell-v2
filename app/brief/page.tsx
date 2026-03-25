"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BriefReaderView } from "@/components/brief/BriefReaderView";
import {
  fetchLatestPublishedBrief,
  fetchCashFlowData,
  fetchUpcomingBillsData,
  fetchHoldingsSnapshot,
  fetchPendingDecisions,
  Brief,
} from "@/lib/brief-service";
import { useEffectiveOrgId } from "@/lib/use-active-principal";

export default function BriefPage() {
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [liveData, setLiveData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    async function load() {
      setIsLoading(true);
      const b = await fetchLatestPublishedBrief(orgId!);
      setBrief(b);

      if (b) {
        const [cashflow, bills7, bills14, bills30, holdings, decisions] =
          await Promise.all([
            fetchCashFlowData(orgId!),
            fetchUpcomingBillsData(orgId!, 7),
            fetchUpcomingBillsData(orgId!, 14),
            fetchUpcomingBillsData(orgId!, 30),
            fetchHoldingsSnapshot(orgId!),
            fetchPendingDecisions(orgId!),
          ]);
        setLiveData({
          cashflow,
          bills_7: bills7,
          bills_14: bills14,
          bills_30: bills30,
          holdings,
          decisions,
        });
      }
      setIsLoading(false);
    }
    load();
  }, [orgId]);

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
          <p className="text-lg text-muted-foreground">No brief available</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your Fusion Cell team has not published a brief yet.
          </p>
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
        <BriefReaderView brief={brief} liveData={liveData} />

        <div className="mt-12 border-t border-border pt-6">
          <Link
            href="/brief/history"
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View previous briefs
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </motion.main>
    </div>
  );
}
