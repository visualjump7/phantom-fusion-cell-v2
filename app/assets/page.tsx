"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Loader2, ChevronRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getCategoryColor } from "@/lib/utils";

interface Asset {
  id: string;
  name: string;
  category: string;
  estimated_value: number;
  description: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function loadAssets() {
      const { data } = await db
        .from("assets")
        .select("id, name, category, estimated_value, description")
        .eq("is_deleted", false)
        .order("estimated_value", { ascending: false });
      setAssets(data || []);
      setIsLoading(false);
    }
    loadAssets();
  }, []);

  const filtered = filter === "all" ? assets : assets.filter((a) => a.category === filter);
  const categories = ["all", ...new Set(assets.map((a) => a.category))];

  const categoryColors: Record<string, string> = {
    family: "bg-emerald-400/10 text-emerald-400 border-emerald-400/30",
    business: "bg-blue-400/10 text-blue-400 border-blue-400/30",
    personal: "bg-violet-400/10 text-violet-400 border-violet-400/30",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <Navbar />
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assets</h1>
            <p className="text-sm text-muted-foreground">Your complete portfolio</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((asset, i) => (
              <motion.div key={asset.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/assets/${asset.id}`}>
                  <Card className="border-border bg-card/60 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card/80">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <Badge variant="outline" className={`text-xs capitalize ${categoryColors[asset.category] || ""}`}>
                          {asset.category}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-foreground">{asset.name}</h3>
                      <p className="mt-1 text-2xl font-bold text-foreground">{formatCurrency(asset.estimated_value)}</p>
                      {asset.description && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{asset.description}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.main>
    </div>
  );
}
