import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { htmlToPdfElements } from "@/lib/html-to-pdf-blocks";
import type {
  Brief,
  BriefBlock,
  CashFlowBlockData,
  BillBlockData,
  ProjectsBlockData,
  DecisionsBlockData,
  CalendarBlockData,
  CalendarEventRow,
} from "@/lib/brief-service";

// ============================================
// Styles
// ============================================

const coverStyles = StyleSheet.create({
  page: { backgroundColor: "#0a0a0a", padding: 60, justifyContent: "center", alignItems: "center" },
  logoContainer: { marginBottom: 40 },
  logo: { maxHeight: 80, maxWidth: 200, objectFit: "contain" as any },
  title: { fontSize: 32, fontWeight: "bold", color: "#ffffff", textAlign: "center", marginBottom: 12 },
  subtitle: { fontSize: 14, color: "#a0a0a0", textAlign: "center", marginBottom: 30 },
  accentLine: { width: 60, height: 2, marginBottom: 30 },
  date: { fontSize: 12, color: "#a0a0a0", textAlign: "center", marginBottom: 8 },
  principal: { fontSize: 12, color: "#a0a0a0", textAlign: "center", marginBottom: 8 },
  footer: { position: "absolute", bottom: 40, left: 60, right: 60, textAlign: "center" },
  footerText: { fontSize: 8, color: "#555555" },
});

const contentStyles = StyleSheet.create({
  page: { backgroundColor: "#ffffff", padding: 50, paddingBottom: 70 },
  header: { marginBottom: 20 },
  briefTitle: { fontSize: 22, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 },
  attribution: { fontSize: 9, color: "#888888", marginBottom: 20 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e0e0e0", marginBottom: 20 },
  blockCard: { border: "1px solid #e0e0e0", borderRadius: 6, padding: 16, marginBottom: 16, backgroundColor: "#fafafa" },
  blockTitle: { fontSize: 12, fontWeight: "bold", color: "#1a1a1a", marginBottom: 10 },
  blockCommentary: { fontSize: 9, color: "#666666", fontStyle: "italic", marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e0e0e0" },
  tableRow: { flexDirection: "row" as const, borderBottomWidth: 1, borderBottomColor: "#eeeeee", paddingVertical: 5 },
  tableHeader: { flexDirection: "row" as const, borderBottomWidth: 2, borderBottomColor: "#cccccc", paddingBottom: 5, marginBottom: 2 },
  tableCell: { fontSize: 9, color: "#333333" },
  tableCellBold: { fontSize: 9, color: "#333333", fontWeight: "bold" },
  totalRow: { flexDirection: "row" as const, paddingTop: 6, marginTop: 4, borderTopWidth: 2, borderTopColor: "#cccccc" },
  dataRow: { flexDirection: "row" as const, justifyContent: "space-between" as const, marginBottom: 6 },
  dataLabel: { fontSize: 9, color: "#888888" },
  dataValue: { fontSize: 14, fontWeight: "bold", color: "#1a1a1a" },
  dataValueRed: { fontSize: 14, fontWeight: "bold", color: "#ef4444" },
  dataValueGreen: { fontSize: 14, fontWeight: "bold", color: "#22c55e" },
  dataValueYellow: { fontSize: 14, fontWeight: "bold", color: "#eab308" },
  badge: { fontSize: 8, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, color: "#ffffff" },
  pageFooter: { position: "absolute", bottom: 30, left: 50, right: 50, flexDirection: "row" as const, justifyContent: "space-between" as const },
  pageFooterText: { fontSize: 7, color: "#aaaaaa" },
});

// ============================================
// Helper
// ============================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

// ============================================
// Props
// ============================================

interface BriefPDFProps {
  brief: Brief;
  liveData: Record<string, any>;
  principalName?: string;
}

// ============================================
// Document
// ============================================

export function BriefPDF({ brief, liveData, principalName }: BriefPDFProps) {
  const accentColor = brief.cover_accent_color || "#4ade80";
  const coverTitle = brief.cover_title || brief.title;
  const briefDate = formatDate(brief.brief_date);

  return (
    <Document>
      {/* COVER PAGE */}
      <Page size="A4" style={coverStyles.page}>
        {brief.cover_logo_url && (
          <View style={coverStyles.logoContainer}>
            <Image src={brief.cover_logo_url} style={coverStyles.logo} />
          </View>
        )}

        <Text style={coverStyles.title}>{coverTitle}</Text>

        {brief.cover_subtitle && (
          <Text style={coverStyles.subtitle}>{brief.cover_subtitle}</Text>
        )}

        <View style={[coverStyles.accentLine, { backgroundColor: accentColor }]} />

        {brief.cover_show_date !== false && (
          <Text style={coverStyles.date}>{briefDate}</Text>
        )}

        {brief.cover_show_principal !== false && principalName && (
          <Text style={coverStyles.principal}>
            Prepared for {principalName}
          </Text>
        )}

        <View style={coverStyles.footer}>
          <Text style={coverStyles.footerText}>
            Confidential — Phantom Services
          </Text>
        </View>
      </Page>

      {/* CONTENT PAGES */}
      <Page size="A4" style={contentStyles.page} wrap>
        <View style={contentStyles.header}>
          <Text style={contentStyles.briefTitle}>{brief.title}</Text>
          <Text style={contentStyles.attribution}>
            {briefDate} · Prepared by your Fusion Cell team
          </Text>
          <View style={contentStyles.divider} />
        </View>

        {brief.blocks?.map((block) => (
          <ContentBlock
            key={block.id}
            block={block}
            liveData={liveData}
          />
        ))}

        <View style={contentStyles.pageFooter} fixed>
          <Text style={contentStyles.pageFooterText}>Confidential</Text>
          <Text style={contentStyles.pageFooterText}>{briefDate}</Text>
          <Text
            style={contentStyles.pageFooterText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

// ============================================
// Content Block Renderer
// ============================================

function ContentBlock({ block, liveData }: { block: BriefBlock; liveData: Record<string, any> }) {
  // Text / Document
  if (block.type === "text" || block.type === "document") {
    if (!block.content_html) return null;
    return <View style={{ marginBottom: 16 }}>{htmlToPdfElements(block.content_html)}</View>;
  }

  // Cash Flow
  if (block.type === "cashflow") {
    const data = liveData.cashflow as CashFlowBlockData | undefined;
    if (!data) return null;
    return (
      <View style={contentStyles.blockCard} wrap={false}>
        <Text style={contentStyles.blockTitle}>Cash Flow — {data.month} {data.year}</Text>
        <View style={{ flexDirection: "row" as const, justifyContent: "space-between" as const }}>
          <View>
            <Text style={contentStyles.dataLabel}>Paid Out</Text>
            <Text style={contentStyles.dataValueRed}>{formatCurrency(data.cashOut / 100)}</Text>
          </View>
          <View>
            <Text style={contentStyles.dataLabel}>Pending</Text>
            <Text style={contentStyles.dataValueYellow}>{data.pendingCount} bills</Text>
          </View>
          <View>
            <Text style={contentStyles.dataLabel}>Net</Text>
            <Text style={data.net < 0 ? contentStyles.dataValueRed : contentStyles.dataValueGreen}>
              {formatCurrency(data.net / 100)}
            </Text>
          </View>
        </View>
        {block.commentary && <Text style={contentStyles.blockCommentary}>{block.commentary}</Text>}
      </View>
    );
  }

  // Bills
  if (block.type === "bills") {
    const daysAhead = block.config?.days_ahead || 7;
    const data = liveData[`bills_${daysAhead}`] as BillBlockData | undefined;
    if (!data) return null;
    return (
      <View style={contentStyles.blockCard} wrap={false}>
        <Text style={contentStyles.blockTitle}>Bills Due — Next {daysAhead} Days</Text>
        {data.bills.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#888888" }}>No bills due in this period.</Text>
        ) : (
          <>
            <View style={contentStyles.tableHeader}>
              <Text style={[contentStyles.tableCellBold, { width: "25%" }]}>Due Date</Text>
              <Text style={[contentStyles.tableCellBold, { width: "35%" }]}>Description</Text>
              <Text style={[contentStyles.tableCellBold, { width: "20%", textAlign: "right" as any }]}>Amount</Text>
              <Text style={[contentStyles.tableCellBold, { width: "20%", textAlign: "right" as any }]}>Project</Text>
            </View>
            {data.bills.map((bill) => (
              <View key={bill.id} style={contentStyles.tableRow}>
                <Text style={[contentStyles.tableCell, { width: "25%" }]}>{formatDate(bill.due_date)}</Text>
                <Text style={[contentStyles.tableCell, { width: "35%" }]}>{bill.title}</Text>
                <Text style={[contentStyles.tableCell, { width: "20%", textAlign: "right" as any }]}>{formatCurrency(bill.amount_cents / 100)}</Text>
                <Text style={[contentStyles.tableCell, { width: "20%", textAlign: "right" as any }]}>{bill.asset_name || "—"}</Text>
              </View>
            ))}
            <View style={contentStyles.totalRow}>
              <Text style={[contentStyles.tableCellBold, { width: "60%" }]}>Total</Text>
              <Text style={[contentStyles.tableCellBold, { width: "20%", textAlign: "right" as any }]}>{formatCurrency(data.total / 100)}</Text>
              <Text style={{ width: "20%" }} />
            </View>
          </>
        )}
        {block.commentary && <Text style={contentStyles.blockCommentary}>{block.commentary}</Text>}
      </View>
    );
  }

  // Projects
  if (block.type === "projects") {
    const data = liveData.projects as ProjectsBlockData | undefined;
    if (!data) return null;
    const filteredProjects = block.config?.category && block.config.category !== "all"
      ? data.projects.filter((h) => h.category === block.config.category)
      : data.projects;
    const filteredTotal = filteredProjects.reduce((s, h) => s + (h.estimated_value || 0), 0);

    return (
      <View style={contentStyles.blockCard} wrap={false}>
        <Text style={contentStyles.blockTitle}>Projects Snapshot</Text>
        {filteredProjects.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#888888" }}>No projects to display.</Text>
        ) : (
          <>
            <View style={contentStyles.tableHeader}>
              <Text style={[contentStyles.tableCellBold, { width: "45%" }]}>Project</Text>
              <Text style={[contentStyles.tableCellBold, { width: "25%" }]}>Category</Text>
              <Text style={[contentStyles.tableCellBold, { width: "30%", textAlign: "right" as any }]}>Est. Value</Text>
            </View>
            {filteredProjects.map((h) => (
              <View key={h.id} style={contentStyles.tableRow}>
                <Text style={[contentStyles.tableCell, { width: "45%" }]}>{h.name}</Text>
                <Text style={[contentStyles.tableCell, { width: "25%", textTransform: "capitalize" as any }]}>{h.category}</Text>
                <Text style={[contentStyles.tableCell, { width: "30%", textAlign: "right" as any }]}>{formatCurrency(h.estimated_value)}</Text>
              </View>
            ))}
            <View style={contentStyles.totalRow}>
              <Text style={[contentStyles.tableCellBold, { width: "70%" }]}>Total</Text>
              <Text style={[contentStyles.tableCellBold, { width: "30%", textAlign: "right" as any }]}>{formatCurrency(filteredTotal)}</Text>
            </View>
          </>
        )}
        {block.commentary && <Text style={contentStyles.blockCommentary}>{block.commentary}</Text>}
      </View>
    );
  }

  // Decisions
  if (block.type === "decisions") {
    const data = liveData.decisions as DecisionsBlockData | undefined;
    if (!data) return null;

    const priorityColors: Record<string, string> = {
      urgent: "#ef4444", high: "#f59e0b", medium: "#3b82f6", low: "#9ca3af",
    };

    return (
      <View style={contentStyles.blockCard} wrap={false}>
        <Text style={contentStyles.blockTitle}>Pending Decisions ({data.count})</Text>
        {data.decisions.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#888888" }}>No pending decisions.</Text>
        ) : (
          data.decisions.map((d) => (
            <View key={d.id} style={{ flexDirection: "row" as const, justifyContent: "space-between" as const, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#eeeeee" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: "#333333" }}>{d.title}</Text>
                {d.due_date && (
                  <Text style={{ fontSize: 8, color: "#888888", marginTop: 2 }}>
                    Due {formatDate(d.due_date)}
                  </Text>
                )}
              </View>
              <View style={[contentStyles.badge, { backgroundColor: priorityColors[d.priority] || "#9ca3af" }]}>
                <Text style={{ fontSize: 8, color: "#ffffff" }}>{d.priority}</Text>
              </View>
            </View>
          ))
        )}
        {block.commentary && <Text style={contentStyles.blockCommentary}>{block.commentary}</Text>}
      </View>
    );
  }

  // Calendar — merged agenda grouped by day.
  if (block.type === "calendar") {
    const daysAhead = block.config?.days_ahead || 7;
    const data = liveData[`calendar_${daysAhead}`] as
      | CalendarBlockData
      | undefined;
    if (!data) return null;

    const byDay = new Map<string, CalendarEventRow[]>();
    for (const ev of data.events) {
      const d = new Date(ev.start_iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      const bucket = byDay.get(key) ?? [];
      bucket.push(ev);
      byDay.set(key, bucket);
    }
    const days = Array.from(byDay.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    const formatDayHeading = (key: string) => {
      const [y, m, d] = key.split("-").map((n) => parseInt(n, 10));
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    };

    const formatEventTime = (ev: CalendarEventRow) => {
      if (ev.is_all_day) return "All day";
      const start = new Date(ev.start_iso);
      const startLabel = start.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      if (!ev.end_iso) return startLabel;
      const end = new Date(ev.end_iso);
      const endLabel = end.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return `${startLabel} – ${endLabel}`;
    };

    return (
      <View style={contentStyles.blockCard} wrap={false}>
        <Text style={contentStyles.blockTitle}>
          Next {data.daysAhead} Days ({data.events.length})
        </Text>
        {data.events.length === 0 ? (
          <Text style={{ fontSize: 9, color: "#888888" }}>
            No events scheduled in this window.
          </Text>
        ) : (
          days.map(([key, events]) => (
            <View key={key} style={{ marginBottom: 8 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontWeight: "bold",
                  color: "#666666",
                  textTransform: "uppercase" as const,
                  letterSpacing: 0.5,
                  marginBottom: 4,
                }}
              >
                {formatDayHeading(key)}
              </Text>
              {events.map((ev) => (
                <View
                  key={ev.id}
                  style={{
                    flexDirection: "row" as const,
                    paddingVertical: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: "#eeeeee",
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: ev.color,
                      marginTop: 4,
                      marginRight: 6,
                    }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: "#333333" }}>
                      {ev.title}
                    </Text>
                    <Text
                      style={{ fontSize: 8, color: "#888888", marginTop: 2 }}
                    >
                      {formatEventTime(ev)} · {ev.source_label}
                      {ev.location ? ` · ${ev.location}` : ""}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))
        )}
        {block.commentary && (
          <Text style={contentStyles.blockCommentary}>{block.commentary}</Text>
        )}
      </View>
    );
  }

  return null;
}
