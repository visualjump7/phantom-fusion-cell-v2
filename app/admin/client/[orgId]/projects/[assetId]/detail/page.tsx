"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useClientContext } from "@/lib/use-client-context";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { getCategoryColor } from "@/lib/utils";
import { ProjectDetailPage } from "@/components/project-detail/ProjectDetailPage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Asset {
  id: string;
  name: string;
  category: string;
}

export default function ProjectDetailRoute() {
  const params = useParams();
  const assetId = params.assetId as string;
  const { orgId, clientName } = useClientContext();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAsset() {
      const { data } = await db
        .from("assets")
        .select("id, name, category")
        .eq("id", assetId)
        .eq("organization_id", orgId)
        .single();

      setAsset(data);
      setIsLoading(false);
    }
    loadAsset();
  }, [assetId, orgId]);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Asset not found.</p>
        <Link
          href={`/admin/client/${orgId}/projects`}
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/admin/client/${orgId}/projects`}
          className="flex items-center gap-1 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
        <span>/</span>
        <span className="text-foreground">{asset.name}</span>
        <span>/</span>
        <span className="text-foreground">Detail</span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">{asset.name}</h1>
          <Badge variant="outline" className={getCategoryColor(asset.category)}>
            {asset.category}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Project profile maintained by {clientName}&apos;s Fusion Cell team
        </p>
      </div>

      {/* Project Detail content */}
      <ProjectDetailPage
        assetId={assetId}
        orgId={orgId}
        assetName={asset.name}
      />
    </div>
  );
}
