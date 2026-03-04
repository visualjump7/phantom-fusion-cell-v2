import * as XLSX from "xlsx";

export interface Transaction {
  label: string;
  amount: number;
  type: "in" | "out";
}

export interface DailyEntry {
  date: string;
  endBalance: number;
  cashIn: number;
  cashOut: number;
  begBalance: number;
  transactions: Transaction[];
}

export interface CashFlowData {
  dailyEntries: DailyEntry[];
  todayEntry: DailyEntry | null;
  lastUpdated: string;
  nextPositiveDate: string | null;
  lastPositiveDate: string | null;
  peakBalance: { date: string; amount: number };
  lowestBalance: { date: string; amount: number };
}

function toISODate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }

  if (typeof value === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + value * 86400000);
    return d.toISOString().split("T")[0];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  }

  return null;
}

function numVal(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function parseCashFlowBuffer(buffer: ArrayBuffer): CashFlowData {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const wsName = wb.SheetNames.find(
    (n) => n.toLowerCase().includes("cash flow") || n.toLowerCase() === "cash flow"
  ) || wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  if (rows.length < 51) {
    return emptyData();
  }

  const dateRow = rows[0];
  const begBalRow = rows[1];
  const cashInSubRow = rows[26];
  const cashOutSubRow = rows[48];
  const endBalRow = rows[50];

  const cashInRows = rows.slice(3, 20);
  const cashOutRows = rows.slice(28, 48);

  const today = todayISO();
  const entries: DailyEntry[] = [];

  for (let col = 2; col < dateRow.length; col++) {
    const dateStr = toISODate(dateRow[col]);
    if (!dateStr) continue;

    const endBalance = numVal(endBalRow?.[col]);
    const cashIn = numVal(cashInSubRow?.[col]);
    const rawCashOut = numVal(cashOutSubRow?.[col]);
    const cashOut = Math.abs(rawCashOut);
    const begBalance = numVal(begBalRow?.[col]);

    const isToday = dateStr === today;
    if (!isToday && endBalance === 0 && cashIn === 0 && cashOut === 0) continue;

    const transactions: Transaction[] = [];

    for (const row of cashInRows) {
      const label = String(row?.[1] ?? row?.[0] ?? "").trim();
      const val = numVal(row?.[col]);
      if (!label || val === 0) continue;
      transactions.push({ label, amount: Math.abs(val), type: "in" });
    }

    for (const row of cashOutRows) {
      const label = String(row?.[1] ?? row?.[0] ?? "").trim();
      const val = numVal(row?.[col]);
      if (!label || val === 0) continue;
      transactions.push({ label, amount: Math.abs(val), type: "out" });
    }

    entries.push({ date: dateStr, endBalance, cashIn, cashOut, begBalance, transactions });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return buildCashFlowData(entries);
}

function buildCashFlowData(entries: DailyEntry[]): CashFlowData {
  const today = todayISO();
  const todayEntry = entries.find((e) => e.date === today) || null;

  let peakBalance = { date: today, amount: -Infinity };
  let lowestBalance = { date: today, amount: Infinity };
  let lastPositiveDate: string | null = null;
  let nextPositiveDate: string | null = null;

  for (const e of entries) {
    if (e.endBalance > peakBalance.amount) {
      peakBalance = { date: e.date, amount: e.endBalance };
    }
    if (e.endBalance < lowestBalance.amount) {
      lowestBalance = { date: e.date, amount: e.endBalance };
    }
    if (e.endBalance > 0 && e.date <= today) {
      lastPositiveDate = e.date;
    }
    if (e.endBalance > 0 && e.date > today && !nextPositiveDate) {
      nextPositiveDate = e.date;
    }
  }

  if (peakBalance.amount === -Infinity) peakBalance = { date: today, amount: 0 };
  if (lowestBalance.amount === Infinity) lowestBalance = { date: today, amount: 0 };

  return {
    dailyEntries: entries,
    todayEntry,
    lastUpdated: new Date().toISOString(),
    nextPositiveDate,
    lastPositiveDate,
    peakBalance,
    lowestBalance,
  };
}

export function getCashFlowForRange(
  entries: DailyEntry[],
  start: string,
  end: string
): DailyEntry[] {
  return entries.filter((e) => e.date >= start && e.date <= end);
}

export function generateDemoCashFlowData(): CashFlowData {
  const entries: DailyEntry[] = [];
  const startDate = new Date(2026, 0, 1);
  let balance = 1_200_000;

  const inLabels = [
    "Charter income", "USAA/Midflorida", "Surfsong refi",
    "Edition floor", "WDRx interest", "Tax refund", "Misc."
  ];
  const outLabels = [
    "Payroll/Admin", "Phantom", "PNC loan", "Hangar financing",
    "MS mortgages", "Personal Bill Pay", "Sunray invoices", "MCA Loans"
  ];

  for (let i = 0; i < 365; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    const transactions: Transaction[] = [];
    let dayIn = 0;
    let dayOut = 0;

    if (i === 28) {
      const amt = 6_500_000;
      transactions.push({ label: "Surfsong refi", amount: amt, type: "in" });
      dayIn += amt;
    }

    if (d.getDate() === 1 || d.getDate() === 15) {
      const payroll = 85_000 + Math.floor(Math.random() * 15_000);
      transactions.push({ label: "Payroll/Admin", amount: payroll, type: "out" });
      dayOut += payroll;
    }

    if (d.getDate() === 5) {
      const mortgage = 32_000;
      transactions.push({ label: "MS mortgages", amount: mortgage, type: "out" });
      dayOut += mortgage;

      const pnc = 28_000;
      transactions.push({ label: "PNC loan", amount: pnc, type: "out" });
      dayOut += pnc;
    }

    if (d.getDate() === 10) {
      const hangar = 85_000;
      transactions.push({ label: "Hangar financing", amount: hangar, type: "out" });
      dayOut += hangar;
    }

    if (d.getDate() === 20) {
      const billPay = 45_000 + Math.floor(Math.random() * 20_000);
      transactions.push({ label: "Personal Bill Pay", amount: billPay, type: "out" });
      dayOut += billPay;

      const sunray = 35_000;
      transactions.push({ label: "Sunray invoices", amount: sunray, type: "out" });
      dayOut += sunray;
    }

    if (Math.random() < 0.08) {
      const charter = 40_000 + Math.floor(Math.random() * 60_000);
      const label = inLabels[Math.floor(Math.random() * 3)];
      transactions.push({ label, amount: charter, type: "in" });
      dayIn += charter;
    }

    if (Math.random() < 0.05) {
      const misc = 5_000 + Math.floor(Math.random() * 30_000);
      const label = outLabels[Math.floor(Math.random() * outLabels.length)];
      transactions.push({ label, amount: misc, type: "out" });
      dayOut += misc;
    }

    const begBalance = balance;
    balance = balance + dayIn - dayOut;

    if (dayIn > 0 || dayOut > 0) {
      entries.push({
        date: dateStr,
        endBalance: Math.round(balance),
        cashIn: dayIn,
        cashOut: dayOut,
        begBalance: Math.round(begBalance),
        transactions,
      });
    }
  }

  return buildCashFlowData(entries);
}

function emptyData(): CashFlowData {
  return {
    dailyEntries: [],
    todayEntry: null,
    lastUpdated: new Date().toISOString(),
    nextPositiveDate: null,
    lastPositiveDate: null,
    peakBalance: { date: todayISO(), amount: 0 },
    lowestBalance: { date: todayISO(), amount: 0 },
  };
}

export function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
