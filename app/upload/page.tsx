"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Asset {
  id: string;
  name: string;
  category: string;
}

export default function UploadPage() {
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [preselected, setPreselected] = useState(false);

  useEffect(() => {
    async function loadAssets() {
      const { data } = await db
        .from("assets")
        .select("id, name, category")
        .eq("is_deleted", false)
        .order("name");
      setAssets(data || []);

      const presetAsset = searchParams.get("asset");
      const presetYear = searchParams.get("year");
      if (presetAsset && data?.some((a: Asset) => a.id === presetAsset)) {
        setSelectedAssetId(presetAsset);
        if (presetYear) setSelectedYear(Number(presetYear));
        setPreselected(true);
      }
    }
    loadAssets();
  }, [searchParams]);

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Upload Center</h1>
        </div>

        {preselected && selectedAsset && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="text-sm text-foreground">
              Uploading budget for <span className="font-semibold">{selectedAsset.name}</span> &middot; {selectedYear}
            </span>
            <button
              onClick={() => { setPreselected(false); setSelectedAssetId(null); }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground"
            >
              Change
            </button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Asset Budgets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Upload Excel budget spreadsheets for individual assets.</p>
              {selectedAsset ? (
                <div className="space-y-2">
                  <Badge variant="outline" className="capitalize">{selectedAsset.category}</Badge>
                  <p className="text-sm font-medium text-foreground">{selectedAsset.name} &middot; {selectedYear}</p>
                  <p className="text-xs text-muted-foreground italic">Budget upload coming in next update.</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Budget upload coming in next update.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Bills / Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Import bill schedules from Excel to populate the fiscal calendar.</p>
              <Button asChild size="sm">
                <Link href="/admin/bills">Import Bills →</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
