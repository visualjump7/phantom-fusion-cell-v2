"use client";

import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UploadPage() {
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-border bg-card/60">
            <CardHeader>
              <CardTitle className="text-base">Asset Budgets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">Upload Excel budget spreadsheets for individual assets.</p>
              <p className="text-xs text-muted-foreground italic">Budget upload coming in next update.</p>
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
