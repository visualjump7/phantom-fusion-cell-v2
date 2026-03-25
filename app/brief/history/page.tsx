"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, FileText, Calendar, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { fetchBriefs, Brief } from "@/lib/brief-service";
import { useEffectiveOrgId } from "@/lib/use-active-principal";

export default function BriefHistoryPage() {
  const { orgId, isLoading: orgLoading } = useEffectiveOrgId();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    async function load() {
      setIsLoading(true);
      const data = await fetchBriefs(orgId!, "published");
      setBriefs(data);
      setIsLoading(false);
    }
    load();
  }, [orgId]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-[680px] px-4 py-10 sm:px-6">
        <Link
          href="/brief"
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to latest brief
        </Link>

        <h1 className="text-2xl font-bold text-foreground">Brief History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All published briefs from your Fusion Cell team
        </p>

        {orgLoading || isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : briefs.length === 0 ? (
          <div className="mt-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">
              No published briefs yet.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 space-y-3"
          >
            {briefs.map((brief) => (
              <Link key={brief.id} href={`/brief/${brief.id}`}>
                <Card className="group cursor-pointer border-border transition-colors hover:bg-muted/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {brief.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(
                          brief.brief_date + "T00:00:00"
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
          </motion.div>
        )}
      </main>
    </div>
  );
}
