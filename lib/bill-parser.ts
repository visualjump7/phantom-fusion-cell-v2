import * as XLSX from "xlsx";

export interface ParsedBill {
  title: string;
  amount_cents: number;
  due_date: string; // YYYY-MM-DD
  category: string | null;
  payee: string | null;
  notes: string | null;
  asset_id?: string | null;
  metadata: Record<string, unknown>;
}

export interface ParseResult {
  bills: ParsedBill[];
  errors: { row: number; message: string }[];
  totalRows: number;
}

// Excel serial date → JS Date
function excelSerialToDate(serial: number): Date {
  const excelEpoch = new Date(1899, 11, 30);
  return new Date(excelEpoch.getTime() + serial * 86400000);
}

// Parse various date formats
function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  // Excel serial number
  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    return date.toISOString().split("T")[0];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    // ISO: 2026-01-15
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    // US: 1/15/2026 or 01/15/2026
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      const month = usMatch[1].padStart(2, "0");
      const day = usMatch[2].padStart(2, "0");
      let year = usMatch[3];
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      return `${year}-${month}-${day}`;
    }

    // Fallback
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return null;
}

// Parse amount to cents
function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Math.round(value * 100);
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num >= 0) {
      return Math.round(num * 100);
    }
  }

  return null;
}

// Normalize column headers
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\s-]+/g, "_");
}

// Header mapping — flexible column name matching
const HEADER_MAP: Record<string, keyof ParsedBill | "metadata"> = {
  due_date: "due_date",
  duedate: "due_date",
  date: "due_date",
  due: "due_date",
  title: "title",
  name: "title",
  bill: "title",
  description: "title",
  amount: "amount_cents",
  amt: "amount_cents",
  total: "amount_cents",
  category: "category",
  cat: "category",
  type: "category",
  payee: "payee",
  vendor: "payee",
  paid_to: "payee",
  paidto: "payee",
  notes: "notes",
  note: "notes",
  memo: "notes",
  comments: "notes",
  asset: "metadata", // We'll handle asset matching separately in the UI
  asset_name: "metadata",
};

export function parseBillsExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });

  if (rawData.length === 0) {
    return {
      bills: [],
      errors: [{ row: 0, message: "Spreadsheet is empty" }],
      totalRows: 0,
    };
  }

  // Map headers
  const originalHeaders = Object.keys(rawData[0]);
  const headerMapping: Record<string, string> = {};

  originalHeaders.forEach((header) => {
    const normalized = normalizeHeader(header);
    const mappedField = HEADER_MAP[normalized];
    if (mappedField) {
      headerMapping[header] = mappedField;
    } else {
      headerMapping[header] = "metadata";
    }
  });

  const bills: ParsedBill[] = [];
  const errors: { row: number; message: string }[] = [];

  rawData.forEach((row, index) => {
    const rowNum = index + 2; // +2: row 1 = headers, 1-indexed

    let title: string | null = null;
    let amount_cents: number | null = null;
    let due_date: string | null = null;
    let category: string | null = null;
    let payee: string | null = null;
    let notes: string | null = null;
    const metadata: Record<string, unknown> = {};

    Object.entries(row).forEach(([header, value]) => {
      const field = headerMapping[header];

      switch (field) {
        case "title":
          title = value ? String(value).trim() : null;
          break;
        case "amount_cents":
          amount_cents = parseAmount(value);
          break;
        case "due_date":
          due_date = parseDate(value);
          break;
        case "category":
          category = value ? String(value).trim() : null;
          break;
        case "payee":
          payee = value ? String(value).trim() : null;
          break;
        case "notes":
          notes = value ? String(value).trim() : null;
          break;
        case "metadata":
          if (value !== null && value !== undefined && value !== "") {
            metadata[header] = value;
          }
          break;
      }
    });

    // Validation
    const rowErrors: string[] = [];
    if (!title) rowErrors.push("Missing title");
    if (amount_cents === null) rowErrors.push("Invalid or missing amount");
    if (!due_date) rowErrors.push("Invalid or missing due date");

    if (rowErrors.length > 0) {
      errors.push({ row: rowNum, message: rowErrors.join(", ") });
      return;
    }

    bills.push({
      title: title!,
      amount_cents: amount_cents!,
      due_date: due_date!,
      category,
      payee,
      notes,
      metadata: Object.keys(metadata).length > 0 ? metadata : {},
    });
  });

  return { bills, errors, totalRows: rawData.length };
}

// Format cents to display dollars
export function formatCentsToDisplay(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// Validate file before parsing
export function validateBillFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const validTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ];

  const validExtensions = [".xlsx", ".xls", ".csv"];
  const extension = file.name
    .substring(file.name.lastIndexOf("."))
    .toLowerCase();

  if (!validTypes.includes(file.type) && !validExtensions.includes(extension)) {
    return {
      valid: false,
      error: "Please upload a valid Excel file (.xlsx, .xls) or CSV file",
    };
  }

  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: "File size must be less than 10MB" };
  }

  return { valid: true };
}
