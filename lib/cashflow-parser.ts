import * as XLSX from "xlsx";

// ─── Types ───

export interface CashFlowTransaction {
  date: string;
  lineItem: string;
  section: "cash_in" | "cash_out" | "investments";
  amount: number;
  direction: "in" | "out";
}

export interface CashFlowWarning {
  row: number;
  col: number;
  lineItem: string;
  date: string;
  value: string;
  message: string;
}

export interface CashFlowParseResult {
  transactions: CashFlowTransaction[];
  warnings: CashFlowWarning[];
  dateRange: { start: string; end: string } | null;
  lineItems: { name: string; section: string; count: number }[];
  summary: {
    totalCashIn: number;
    totalCashOut: number;
    netCashFlow: number;
    transactionCount: number;
    dateCount: number;
  };
}

// ─── Helpers ───

function excelDateToISO(serial: number): string | null {
  if (serial < 1) return null;
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + serial * 86400000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function isNumeric(val: unknown): val is number {
  return typeof val === "number" && !isNaN(val);
}

type Section = "cash_in" | "cash_out" | "investments";

const SECTION_MAP: Record<string, Section> = {
  "cash in": "cash_in",
  "cash out": "cash_out",
  "investements": "investments",
  "investments": "investments",
};

const SKIP_LINE_ITEMS = new Set([
  "subtotal", "beg. balance", "beginning balance",
  "end balance", "ending balance", "net cash", "net",
]);

// ─── Parser ───

export function parseCashFlowFile(buffer: ArrayBuffer): CashFlowParseResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });

  const sheetName = wb.SheetNames.find(
    (n) => n.toLowerCase().includes("cash flow") || n.toLowerCase().includes("cashflow")
  ) || wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  if (rows.length < 3) {
    return {
      transactions: [], warnings: [], dateRange: null, lineItems: [],
      summary: { totalCashIn: 0, totalCashOut: 0, netCashFlow: 0, transactionCount: 0, dateCount: 0 },
    };
  }

  const dateRow = rows[0];
  const dateColumns: Map<number, string> = new Map();

  for (let c = 3; c < dateRow.length; c++) {
    const val = dateRow[c];
    if (val === null || val === undefined) continue;
    if (isNumeric(val) && val > 40000 && val < 60000) {
      const iso = excelDateToISO(val);
      if (iso) dateColumns.set(c, iso);
    } else if (typeof val === "string") {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        dateColumns.set(c, `${y}-${m}-${d}`);
      }
    }
  }

  const transactions: CashFlowTransaction[] = [];
  const warnings: CashFlowWarning[] = [];
  let currentSection: Section = "cash_in";

  const lineItemCounts = new Map<string, { section: string; count: number }>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const colA = cellToString(row[0]).toLowerCase();
    const colB = cellToString(row[1]);

    if (colA && SECTION_MAP[colA]) {
      currentSection = SECTION_MAP[colA];
      continue;
    }

    if (colA.includes("beg") && colA.includes("balance")) continue;

    const lineItem = colB || cellToString(row[0]);
    if (!lineItem) continue;

    if (SKIP_LINE_ITEMS.has(lineItem.toLowerCase())) continue;

    const direction: "in" | "out" = currentSection === "cash_out" ? "out" : "in";

    for (const [colIdx, dateStr] of dateColumns) {
      const cellVal = row[colIdx];
      if (cellVal === null || cellVal === undefined) continue;

      if (typeof cellVal === "string") {
        const trimmed = cellVal.trim();
        if (trimmed === "" || trimmed === "0") continue;
        const numAttempt = parseFloat(trimmed.replace(/[$,]/g, ""));
        if (!isNaN(numAttempt) && numAttempt !== 0) {
          transactions.push({ date: dateStr, lineItem, section: currentSection, amount: numAttempt, direction });
          const key = `${lineItem}|${currentSection}`;
          const prev = lineItemCounts.get(key) || { section: currentSection, count: 0 };
          lineItemCounts.set(key, { ...prev, count: prev.count + 1 });
          continue;
        }
        warnings.push({
          row: r + 1, col: colIdx + 1, lineItem, date: dateStr,
          value: trimmed, message: `Text annotation: "${trimmed}"`,
        });
        continue;
      }

      if (isNumeric(cellVal) && cellVal !== 0) {
        transactions.push({ date: dateStr, lineItem, section: currentSection, amount: cellVal, direction });
        const key = `${lineItem}|${currentSection}`;
        const prev = lineItemCounts.get(key) || { section: currentSection, count: 0 };
        lineItemCounts.set(key, { ...prev, count: prev.count + 1 });
      }
    }
  }

  const dates = [...dateColumns.values()].sort();
  const totalCashIn = transactions.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
  const totalCashOut = transactions.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const uniqueDates = new Set(transactions.map((t) => t.date));

  const lineItems = Array.from(lineItemCounts.entries()).map(([key, val]) => {
    const [name] = key.split("|");
    return { name, section: val.section, count: val.count };
  });

  return {
    transactions,
    warnings,
    dateRange: dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null,
    lineItems,
    summary: {
      totalCashIn,
      totalCashOut,
      netCashFlow: totalCashIn - totalCashOut,
      transactionCount: transactions.length,
      dateCount: uniqueDates.size,
    },
  };
}

export function parseFilenameDate(filename: string): string | null {
  const match = filename.match(/(\d{1,2})_(\d{1,2})_(\d{4})/);
  if (!match) return null;
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function validateCashFlowFile(file: File): { valid: boolean; error?: string } {
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
  if (![".xlsx", ".xls"].includes(ext)) {
    return { valid: false, error: "Please upload an Excel file (.xlsx or .xls)" };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { valid: false, error: "File size must be less than 20MB" };
  }
  return { valid: true };
}
