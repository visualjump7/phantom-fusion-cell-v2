import * as XLSX from "xlsx";

export interface ParsedBudgetLine {
  category: string;
  description: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  annual_total: number;
}

export interface BudgetParseResult {
  lines: ParsedBudgetLine[];
  errors: { row: number; message: string }[];
  totalRows: number;
}

const MONTH_HEADERS: Record<string, keyof ParsedBudgetLine> = {
  jan: "jan", january: "jan",
  feb: "feb", february: "feb",
  mar: "mar", march: "mar",
  apr: "apr", april: "apr",
  may: "may",
  jun: "jun", june: "jun",
  jul: "jul", july: "jul",
  aug: "aug", august: "aug",
  sep: "sep", september: "sep", sept: "sep",
  oct: "oct", october: "oct",
  nov: "nov", november: "nov",
  dec: "dec", december: "dec",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\s-]+/g, "_");
}

function parseNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

export function parseBudgetFile(buffer: ArrayBuffer): BudgetParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: null,
    raw: true,
  });

  if (rawData.length === 0) {
    return { lines: [], errors: [{ row: 0, message: "Spreadsheet is empty" }], totalRows: 0 };
  }

  const originalHeaders = Object.keys(rawData[0]);
  const headerMap: Record<string, string> = {};

  originalHeaders.forEach((header) => {
    const norm = normalizeHeader(header);
    if (norm === "category" || norm === "cat" || norm === "type" || norm === "expense_category") {
      headerMap[header] = "category";
    } else if (norm === "description" || norm === "desc" || norm === "name" || norm === "item" || norm === "line_item") {
      headerMap[header] = "description";
    } else if (norm === "annual_total" || norm === "annual" || norm === "total" || norm === "yearly" || norm === "year_total") {
      headerMap[header] = "annual_total";
    } else if (MONTH_HEADERS[norm]) {
      headerMap[header] = MONTH_HEADERS[norm] as string;
    }
  });

  const lines: ParsedBudgetLine[] = [];
  const errors: { row: number; message: string }[] = [];

  rawData.forEach((row, index) => {
    const rowNum = index + 2;

    let category = "";
    let description = "";
    const months: Record<string, number> = {
      jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
      jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0,
    };
    let annualTotal: number | null = null;

    Object.entries(row).forEach(([header, value]) => {
      const field = headerMap[header];
      if (!field) return;

      if (field === "category") {
        category = value ? String(value).trim() : "";
      } else if (field === "description") {
        description = value ? String(value).trim() : "";
      } else if (field === "annual_total") {
        annualTotal = parseNumber(value);
      } else if (months.hasOwnProperty(field)) {
        months[field] = parseNumber(value);
      }
    });

    if (!description) {
      if (category) {
        description = category;
      } else {
        errors.push({ row: rowNum, message: "Missing description" });
        return;
      }
    }

    if (!category) {
      category = "General";
    }

    const computedTotal = Object.values(months).reduce((s, v) => s + v, 0);
    const finalTotal = annualTotal !== null ? annualTotal : computedTotal;

    lines.push({
      category,
      description,
      ...months,
      annual_total: finalTotal,
    } as ParsedBudgetLine);
  });

  return { lines, errors, totalRows: rawData.length };
}

export function generateBudgetTemplate(): ArrayBuffer {
  const headers = [
    "Category", "Description",
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    "Annual Total",
  ];

  const sampleData = [
    ["Maintenance", "Landscaping", 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 30000],
    ["Insurance", "Property Insurance", 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 18000],
    ["Utilities", "Electric & Gas", 800, 750, 600, 500, 400, 600, 900, 950, 700, 550, 650, 800, 8200],
    ["Taxes", "Property Tax", 0, 0, 0, 15000, 0, 0, 0, 0, 0, 15000, 0, 0, 30000],
    ["Staff", "Security Guard", 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 4000, 48000],
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

  const colWidths = [15, 20, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 12];
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Budget");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}

export function validateBudgetFile(file: File): { valid: boolean; error?: string } {
  const validExtensions = [".xlsx", ".xls", ".csv"];
  const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

  if (!validExtensions.includes(ext)) {
    return { valid: false, error: "Please upload a valid Excel file (.xlsx, .xls) or CSV file" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: "File size must be less than 10MB" };
  }
  return { valid: true };
}
