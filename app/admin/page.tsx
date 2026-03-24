"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { OverviewStats } from "@/components/admin/overview/OverviewStats";
import { ClientCard } from "@/components/admin/overview/ClientCard";
import { fetchAllClientsSummary, ClientSummary } from "@/lib/client-service";

export default function CommandCenterPage() {
  const [summaries, setSummaries] = useState<ClientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAllClientsSummary().then((data) => {
      setSummaries(data);
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview across all principals. Select a workspace to manage.
        </p>
      </div>

      <OverviewStats summaries={summaries} />

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Principals</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {summaries.map((summary) => (
            <ClientCard key={summary.orgId} summary={summary} />
          ))}
          {summaries.length === 0 && (
            <p className="col-span-2 text-sm text-muted-foreground">
              No principals onboarded yet. Use the sidebar to onboard a new principal.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
