/**
 * Budget Editor — export to .xlsx
 *
 * Generates a styled Excel workbook matching the layout that
 * lib/budget-parser.ts already understands, so exported files can be
 * round-tripped back via the Import flow. Column layout:
 *   A: section headers (banner in row 1, "GRAND TOTAL" on the grand row)
 *   C: account description (line items, category headers, "TOTAL", "GRAND TOTAL")
 *   E-P: January through December
 *   Q: annual total
 *
 * This export is formula-driven:
 *   - Line item monthly cells are static values (source of truth).
 *   - Line item Q (annual) is =SUM(E{row}:P{row}).
 *   - Category TOTAL row monthly cells are =SUM({col}{firstItem}:{col}{lastItem}).
 *   - Category TOTAL row annual is =SUM(E{totalRow}:P{totalRow}).
 *   - Grand TOTAL monthly cells are =SUM across each category TOTAL row.
 *   - Grand TOTAL annual is =SUM(E{grandRow}:P{grandRow}).
 *
 * This export is fully styled (light-mode professional palette):
 *   - Column header row: dark #1a1a1a background, white bold text
 *   - Category header rows: light mint #f0fdf4 background, dark green #166534 bold
 *   - Category TOTAL rows: light gray #f8f8f8, bold, thin top border #d4d4d4
 *   - Line item rows: white, #374151 text, alternating shading #fafafa
 *   - Annual column: bold throughout, dark green #166534 on line items
 *   - Grand TOTAL row: near-black #111111, white monthly + mint annual, bold,
 *     double top border #222222
 *   - Freeze panes: header row + description column stay pinned
 *   - Print: landscape, fit-to-width, repeat header row
 *   - Sheet tab color: #4ade80
 *
 * Uses xlsx-js-style (drop-in fork of SheetJS that writes cell styles)
 * instead of the community xlsx package which silently drops them.
 */

import * as XLSX from "xlsx-js-style";
// JSZip is a transitive dependency of xlsx-js-style; we use it directly
// to patch freeze panes, tab color, and pageSetup into the exported XML.
import JSZip from "jszip";
import type { FetchedBudget } from "./budget-editor-service";
import { MONTHS } from "./budget-editor-service";

// ─── Layout constants ───────────────────────────────────────────────────

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Fusion Cell template column indices (0-based).
const COL_BANNER = 0; // A — banner + grand total label
const COL_DESCRIPTION = 2; // C — descriptions, "TOTAL", category headers
const COL_JAN = 4; // E — January
const COL_DEC = 15; // P — December
const COL_ANNUAL = 16; // Q — annual total
const ROW_WIDTH = 17; // A..Q

// Excel number format: currency with two decimals.
const CURRENCY_FMT = '"$"#,##0.00';

// ─── Palette (no # prefix — xlsx-js-style expects raw hex) ──────────────

const C = {
  headerFill: "1A1A1A",
  headerText: "FFFFFF",

  catHeaderFill: "F0FDF4",
  catHeaderText: "166534",

  catTotalFill: "F8F8F8",
  catTotalBorder: "D4D4D4",

  lineText: "374151",
  lineAlt: "FAFAFA",
  lineWhite: "FFFFFF",

  grandFill: "111111",
  grandTextWhite: "FFFFFF",
  grandTextMint: "4ADE80",
  grandBorder: "222222",

  annualGreen: "166534",

  fixedGreen: "166534",
  variableAmber: "A16207",

  sheetTab: "4ADE80",
};

/** Convert a 0-based column index to its A1 letter (4 → "E"). */
function colLetter(col: number): string {
  return XLSX.utils.encode_col(col);
}

// ─── Layout metadata ────────────────────────────────────────────────────

interface CategoryLayout {
  categoryHeaderRow: number; // 1-based
  firstItemRow: number;
  lastItemRow: number;
  totalRow: number;
  itemRows: number[];
  hasItems: boolean;
}

interface LayoutMeta {
  headerRow: number; // 1-based — column header row
  categories: CategoryLayout[];
  grandTotalRow: number | null;
  lastRow: number;
}

// ─── Row builder ────────────────────────────────────────────────────────

/**
 * Build the raw row data for the worksheet AND track the Excel row
 * positions of every structural element so applyFormulasAndStyles() can
 * patch formulas + styles onto the correct cells afterwards. Static
 * numeric seed values are written now; they become the cached values that
 * sit alongside the formulas.
 */
function buildRowsAndLayout(budget: FetchedBudget): {
  rows: (string | number)[][];
  layout: LayoutMeta;
} {
  const rows: (string | number)[][] = [];
  const layout: LayoutMeta = {
    headerRow: 0,
    categories: [],
    grandTotalRow: null,
    lastRow: 0,
  };

  const makeBlankRow = (): (string | number)[] => Array(ROW_WIDTH).fill("");

  // Row 1 — project banner in col A (parser ignores it because col C is empty).
  const bannerRow = makeBlankRow();
  bannerRow[COL_BANNER] = `${budget.assetName} — ${budget.year} Budget`;
  rows.push(bannerRow);

  // Row 2 — column headers. Parser skips "Account Description" via SKIP_NAMES.
  const headerRow = makeBlankRow();
  headerRow[COL_DESCRIPTION] = "Account Description";
  for (let i = 0; i < 12; i++) headerRow[COL_JAN + i] = MONTH_LABELS[i];
  headerRow[COL_ANNUAL] = "Total";
  rows.push(headerRow);
  layout.headerRow = rows.length; // 1-based (2)

  // Row 3 — blank separator.
  rows.push(makeBlankRow());

  // One block per category.
  for (const cat of budget.categories) {
    // Category header row (parser recognises this as a category because
    // there is no numeric data on the row).
    const catHeaderRow = makeBlankRow();
    catHeaderRow[COL_DESCRIPTION] = cat.name;
    rows.push(catHeaderRow);
    const categoryHeaderExcelRow = rows.length;

    const itemRowsForCat: number[] = [];

    // Line item rows.
    for (const item of cat.items) {
      const itemRow = makeBlankRow();
      itemRow[COL_DESCRIPTION] = item.description;
      const months = MONTHS.map((m) => Number(item[m] || 0));
      for (let i = 0; i < 12; i++) itemRow[COL_JAN + i] = months[i];
      // Cached annual; formula overrides this cell in the patch pass.
      itemRow[COL_ANNUAL] = months.reduce((sum, v) => sum + v, 0);
      rows.push(itemRow);
      itemRowsForCat.push(rows.length); // 1-based Excel row number
    }

    // Category TOTAL row. Cached values now; formulas applied later.
    const totalRow = makeBlankRow();
    totalRow[COL_DESCRIPTION] = "TOTAL";
    const catMonthly = new Array(12).fill(0) as number[];
    let catAnnual = 0;
    for (const item of cat.items) {
      const annual = MONTHS.reduce((s, m) => s + Number(item[m] || 0), 0);
      catAnnual += annual;
      for (let i = 0; i < 12; i++) {
        catMonthly[i] += Number(item[MONTHS[i]] || 0);
      }
    }
    for (let i = 0; i < 12; i++) totalRow[COL_JAN + i] = catMonthly[i];
    totalRow[COL_ANNUAL] = catAnnual;
    rows.push(totalRow);
    const catTotalExcelRow = rows.length;

    layout.categories.push({
      categoryHeaderRow: categoryHeaderExcelRow,
      firstItemRow: itemRowsForCat[0] ?? catTotalExcelRow,
      lastItemRow: itemRowsForCat[itemRowsForCat.length - 1] ?? catTotalExcelRow,
      totalRow: catTotalExcelRow,
      itemRows: itemRowsForCat,
      hasItems: itemRowsForCat.length > 0,
    });

    // Blank separator between categories.
    rows.push(makeBlankRow());
  }

  // Grand TOTAL row. Cached values now; formulas applied later.
  const grandRow = makeBlankRow();
  grandRow[COL_BANNER] = "GRAND TOTAL";
  grandRow[COL_DESCRIPTION] = "GRAND TOTAL";
  const grandMonthly = new Array(12).fill(0) as number[];
  for (const cat of budget.categories) {
    for (const item of cat.items) {
      for (let i = 0; i < 12; i++) {
        grandMonthly[i] += Number(item[MONTHS[i]] || 0);
      }
    }
  }
  const grandAnnual = grandMonthly.reduce((s, v) => s + v, 0);
  for (let i = 0; i < 12; i++) grandRow[COL_JAN + i] = grandMonthly[i];
  grandRow[COL_ANNUAL] = grandAnnual;
  rows.push(grandRow);
  layout.grandTotalRow = rows.length;
  layout.lastRow = rows.length;

  return { rows, layout };
}

// ─── Style presets ──────────────────────────────────────────────────────

type CellStyle = NonNullable<XLSX.CellObject["s"]>;

function headerStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: C.headerText }, sz: 11, name: "Arial" },
    fill: { patternType: "solid", fgColor: { rgb: C.headerFill } },
    alignment: { vertical: "center", horizontal: "center", wrapText: false },
  };
}

function headerStyleDescription(): CellStyle {
  return {
    ...headerStyle(),
    alignment: { vertical: "center", horizontal: "left", wrapText: false },
  };
}

function categoryHeaderStyle(): CellStyle {
  return {
    font: { bold: true, color: { rgb: C.catHeaderText }, sz: 11, name: "Arial" },
    fill: { patternType: "solid", fgColor: { rgb: C.catHeaderFill } },
    alignment: { vertical: "center", horizontal: "left" },
  };
}

/** Category TOTAL row cells — shared base style. */
function categoryTotalStyle(
  opts: { numeric: boolean; isAnnual?: boolean } = { numeric: true }
): CellStyle {
  return {
    font: {
      bold: true,
      color: { rgb: opts.isAnnual ? C.annualGreen : C.lineText },
      sz: 11,
      name: "Arial",
    },
    fill: { patternType: "solid", fgColor: { rgb: C.catTotalFill } },
    alignment: {
      vertical: "center",
      horizontal: opts.numeric ? "right" : "left",
    },
    border: {
      top: { style: "thin", color: { rgb: C.catTotalBorder } },
    },
    numFmt: opts.numeric ? CURRENCY_FMT : undefined,
  };
}

/** Base line item style — per-cell overrides add color/alt shading. */
function lineItemStyle(
  opts: {
    isAlt: boolean;
    numeric: boolean;
    isAnnual?: boolean;
  }
): CellStyle {
  return {
    font: {
      color: {
        rgb: opts.isAnnual ? C.annualGreen : C.lineText,
      },
      bold: !!opts.isAnnual,
      sz: 11,
      name: "Arial",
    },
    fill: {
      patternType: "solid",
      fgColor: { rgb: opts.isAlt ? C.lineAlt : C.lineWhite },
    },
    alignment: {
      vertical: "center",
      horizontal: opts.numeric ? "right" : "left",
    },
    numFmt: opts.numeric ? CURRENCY_FMT : undefined,
  };
}

function grandTotalStyle(opts: {
  isAnnual: boolean;
  isLabel?: boolean;
}): CellStyle {
  return {
    font: {
      bold: true,
      color: {
        rgb: opts.isAnnual ? C.grandTextMint : C.grandTextWhite,
      },
      sz: opts.isAnnual ? 12 : 11,
      name: "Arial",
    },
    fill: { patternType: "solid", fgColor: { rgb: C.grandFill } },
    alignment: {
      vertical: "center",
      horizontal: opts.isLabel ? "left" : "right",
    },
    border: {
      top: { style: "double", color: { rgb: C.grandBorder } },
    },
    numFmt: opts.isLabel ? undefined : CURRENCY_FMT,
  };
}

function bannerStyle(): CellStyle {
  return {
    font: {
      bold: true,
      color: { rgb: C.lineText },
      sz: 14,
      name: "Arial",
    },
    alignment: { vertical: "center", horizontal: "left" },
    fill: { patternType: "solid", fgColor: { rgb: C.lineWhite } },
  };
}

// ─── Formula + style application ────────────────────────────────────────

/**
 * Patch formulas into seeded numeric cells and apply every style pass.
 * All writes go directly into the worksheet object by cell reference.
 */
function applyFormulasAndStyles(
  ws: XLSX.WorkSheet,
  layout: LayoutMeta
): void {
  const janL = colLetter(COL_JAN);
  const decL = colLetter(COL_DEC);

  /** Merge a style into an existing cell (preserves v / f / t). */
  const setStyle = (col: number, row1: number, style: CellStyle) => {
    const ref = XLSX.utils.encode_cell({ c: col, r: row1 - 1 });
    const existing = ws[ref];
    if (!existing) {
      // Create an empty cell with just the style (so blank cells in styled
      // rows still paint the background across the full column span).
      ws[ref] = { t: "s", v: "", s: style };
      return;
    }
    existing.s = style;
    if (style.numFmt) existing.z = style.numFmt;
  };

  /** Write a formula cell, preserving any seeded cached value. */
  const writeFormula = (
    col: number,
    row1: number,
    formula: string,
    style: CellStyle
  ) => {
    const ref = XLSX.utils.encode_cell({ c: col, r: row1 - 1 });
    const existingValue =
      typeof ws[ref]?.v === "number" ? (ws[ref].v as number) : 0;
    ws[ref] = {
      t: "n",
      f: formula,
      v: existingValue,
      z: CURRENCY_FMT,
      s: style,
    };
  };

  // ── Row 1: banner ────────────────────────────────────────────────────
  setStyle(COL_BANNER, 1, bannerStyle());
  // Paint the rest of row 1 white so it isn't transparent.
  for (let c = 1; c < ROW_WIDTH; c++) {
    setStyle(c, 1, {
      fill: { patternType: "solid", fgColor: { rgb: C.lineWhite } },
    });
  }

  // ── Row 2: column headers ────────────────────────────────────────────
  const headerRow = layout.headerRow;
  // Span styling across the entire row width so the header strip is solid.
  for (let c = 0; c < ROW_WIDTH; c++) {
    if (c === COL_DESCRIPTION) {
      setStyle(c, headerRow, headerStyleDescription());
    } else if (c >= COL_JAN && c <= COL_ANNUAL) {
      setStyle(c, headerRow, headerStyle());
    } else {
      // Spacers (B, D) + col A get a dark fill to extend the header strip
      // visually but without any text.
      setStyle(c, headerRow, {
        fill: { patternType: "solid", fgColor: { rgb: C.headerFill } },
      });
    }
  }

  // ── Categories ───────────────────────────────────────────────────────
  for (const cat of layout.categories) {
    // Category header row — paint full width, bold green text in col C.
    for (let c = 0; c < ROW_WIDTH; c++) {
      setStyle(c, cat.categoryHeaderRow, {
        fill: { patternType: "solid", fgColor: { rgb: C.catHeaderFill } },
        font:
          c === COL_DESCRIPTION
            ? { bold: true, color: { rgb: C.catHeaderText }, sz: 11, name: "Arial" }
            : undefined,
        alignment:
          c === COL_DESCRIPTION
            ? { vertical: "center", horizontal: "left" }
            : undefined,
      });
    }
    if (cat.hasItems) {
      // Overwrite col C with the full category header style to be safe.
      setStyle(COL_DESCRIPTION, cat.categoryHeaderRow, categoryHeaderStyle());
    }

    // Line items — static monthly cells + formula annual cell + row shading.
    cat.itemRows.forEach((itemRow, idx) => {
      const isAlt = idx % 2 === 1;

      // Paint full row width with the shading colour (so col A/B/D
      // spacers don't break the alternating stripe pattern).
      for (let c = 0; c < ROW_WIDTH; c++) {
        setStyle(c, itemRow, {
          fill: {
            patternType: "solid",
            fgColor: { rgb: isAlt ? C.lineAlt : C.lineWhite },
          },
        });
      }

      // Description cell (col C) — text style.
      setStyle(
        COL_DESCRIPTION,
        itemRow,
        lineItemStyle({ isAlt, numeric: false })
      );

      // Monthly cells (E..P) — static numeric values with currency format.
      for (let c = COL_JAN; c <= COL_DEC; c++) {
        setStyle(c, itemRow, lineItemStyle({ isAlt, numeric: true }));
      }

      // Annual cell (Q) — formula + bold + green.
      writeFormula(
        COL_ANNUAL,
        itemRow,
        `SUM(${janL}${itemRow}:${decL}${itemRow})`,
        lineItemStyle({ isAlt, numeric: true, isAnnual: true })
      );
    });

    // Category TOTAL row.
    if (cat.hasItems) {
      const totalRow = cat.totalRow;
      const firstItem = cat.firstItemRow;
      const lastItem = cat.lastItemRow;

      // Paint full width with the gray fill + top border.
      for (let c = 0; c < ROW_WIDTH; c++) {
        setStyle(c, totalRow, {
          fill: { patternType: "solid", fgColor: { rgb: C.catTotalFill } },
          border: {
            top: { style: "thin", color: { rgb: C.catTotalBorder } },
          },
        });
      }

      setStyle(
        COL_DESCRIPTION,
        totalRow,
        categoryTotalStyle({ numeric: false })
      );

      // Monthly cells — SUM across this category's line items.
      for (let c = COL_JAN; c <= COL_DEC; c++) {
        const colL = colLetter(c);
        writeFormula(
          c,
          totalRow,
          `SUM(${colL}${firstItem}:${colL}${lastItem})`,
          categoryTotalStyle({ numeric: true })
        );
      }

      // Annual cell — SUM across this row's own monthly totals.
      writeFormula(
        COL_ANNUAL,
        totalRow,
        `SUM(${janL}${totalRow}:${decL}${totalRow})`,
        categoryTotalStyle({ numeric: true, isAnnual: true })
      );
    }
  }

  // ── Grand TOTAL row ──────────────────────────────────────────────────
  if (layout.grandTotalRow !== null && layout.categories.some((c) => c.hasItems)) {
    const grandRow = layout.grandTotalRow;
    const catRows = layout.categories
      .filter((c) => c.hasItems)
      .map((c) => c.totalRow);

    // Paint the full row width with the dark fill + double border.
    for (let c = 0; c < ROW_WIDTH; c++) {
      setStyle(c, grandRow, {
        fill: { patternType: "solid", fgColor: { rgb: C.grandFill } },
        border: {
          top: { style: "double", color: { rgb: C.grandBorder } },
        },
      });
    }

    // Col A + Col C labels.
    setStyle(COL_BANNER, grandRow, grandTotalStyle({ isAnnual: false, isLabel: true }));
    setStyle(COL_DESCRIPTION, grandRow, grandTotalStyle({ isAnnual: false, isLabel: true }));

    // Monthly cells — SUM across every category TOTAL row at that column.
    for (let c = COL_JAN; c <= COL_DEC; c++) {
      const colL = colLetter(c);
      const addends = catRows.map((r) => `${colL}${r}`).join(",");
      writeFormula(c, grandRow, `SUM(${addends})`, grandTotalStyle({ isAnnual: false }));
    }

    // Annual — SUM across the grand total row's own monthly cells, mint text.
    writeFormula(
      COL_ANNUAL,
      grandRow,
      `SUM(${janL}${grandRow}:${decL}${grandRow})`,
      grandTotalStyle({ isAnnual: true })
    );
  }
}

// ─── Worksheet-level settings (freeze, print, tab color) ────────────────

function applyWorksheetSettings(ws: XLSX.WorkSheet, layout: LayoutMeta): void {
  // Column widths — spec:
  //   Description ≈ 35 chars (col C)
  //   Month cols   = 14 chars (E..P)
  //   Annual col   = 16 chars (Q)
  ws["!cols"] = [
    { wch: 22 }, // A — banner / grand total label
    { wch: 3 }, // B — spacer
    { wch: 35 }, // C — descriptions
    { wch: 2 }, // D — spacer
    { wch: 14 }, // E–P — months
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 }, // Q — annual total
  ];

  // Header row height — slightly taller for the branded strip.
  ws["!rows"] = [];
  ws["!rows"][layout.headerRow - 1] = { hpx: 26 };

  // ── Freeze panes ────────────────────────────────────────────────────
  // xlsx-js-style writes <sheetView><pane/></sheetView> from ws['!freeze']
  // if it's present, OR we can inject the XML fragment via !sheetViews
  // after write. The most reliable cross-version approach: set the
  // pane directly via the sheet view array with the shape the writer
  // understands — but because xlsx-js-style doesn't natively serialise
  // that, we stash it in a custom field and inject during the post-write
  // pass below (see buildBudgetWorkbook).
  //
  // What we *can* reliably do through the API is ensure the sheet has a
  // view entry — the XML injection at write-time will add <pane/> to it.
  //
  // Record the intent here:
  (ws as unknown as { __fcFreeze: { xSplit: number; ySplit: number; topLeftCell: string } }).__fcFreeze = {
    xSplit: COL_DESCRIPTION + 1, // freeze cols A..C
    ySplit: layout.headerRow, // freeze rows 1..headerRow
    topLeftCell: XLSX.utils.encode_cell({
      r: layout.headerRow,
      c: COL_DESCRIPTION + 1,
    }),
  };

  // ── Page setup ──────────────────────────────────────────────────────
  // Record print orientation/fit for the post-write XML patch. xlsx-js-style
  // doesn't emit <pageSetup> or <pageSetupPr> from !pageSetup reliably.
  (ws as unknown as { __fcPageSetup: boolean }).__fcPageSetup = true;
  ws["!margins"] = {
    left: 0.5,
    right: 0.5,
    top: 0.5,
    bottom: 0.5,
    header: 0.3,
    footer: 0.3,
  };

  // ── Sheet tab color ─────────────────────────────────────────────────
  // Goes into <sheetPr><tabColor/></sheetPr> at the top of the sheet XML.
  // Record the intent; the post-write patch adds the element.
  (ws as unknown as { __fcTabColor: string }).__fcTabColor = C.sheetTab;

  // Make sure !ref covers the full written range.
  const sheetRangeEnd = layout.lastRow;
  ws["!ref"] = `A1:${XLSX.utils.encode_col(ROW_WIDTH - 1)}${sheetRangeEnd}`;
}

/**
 * xlsx-js-style doesn't serialise freeze panes, tab color, or the
 * <pageSetup>/<pageSetupPr> elements from its high-level API. We fix that
 * with a targeted string patch against the ZIP contents after write.
 * Everything else (fonts, fills, borders, formulas, Print_Titles defined
 * name) is already correct in the initial write.
 */
async function patchWorkbookXml(
  buffer: ArrayBuffer,
  tabColor: string,
  freeze: { xSplit: number; ySplit: number; topLeftCell: string }
): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = "xl/worksheets/sheet1.xml";
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return buffer;

  let xml = await sheetFile.async("string");

  // 1. Inject <sheetPr><tabColor rgb="..."/></sheetPr> as the first element
  // after the <worksheet ...> open tag (order matters in the schema).
  if (!xml.includes("<sheetPr")) {
    xml = xml.replace(
      /(<worksheet[^>]*>)/,
      `$1<sheetPr><tabColor rgb="FF${tabColor}"/><pageSetUpPr fitToPage="1"/></sheetPr>`
    );
  }

  // 2. Inject <pane/> inside the existing <sheetView>.
  // Current: <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  // Target:  <sheetViews><sheetView workbookViewId="0"><pane xSplit=".." ySplit=".." topLeftCell=".." activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
  xml = xml.replace(
    /<sheetView([^>]*)\/>/,
    (_m, attrs) =>
      `<sheetView${attrs}><pane xSplit="${freeze.xSplit}" ySplit="${freeze.ySplit}" topLeftCell="${freeze.topLeftCell}" activePane="bottomRight" state="frozen"/></sheetView>`
  );

  // 3. Inject <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="1"/>
  // The schema requires this to come in a specific order. It should appear
  // after <pageMargins/>. We already write !margins via the high-level API
  // so <pageMargins/> exists in the XML.
  if (!xml.includes("<pageSetup ")) {
    xml = xml.replace(
      /(<pageMargins[^/]*\/>)/,
      `$1<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="1"/>`
    );
  }

  zip.file(sheetPath, xml);
  const out = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return out;
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Build the initial workbook (sync). This returns a buffer that has:
 *   • All formulas
 *   • All number formats
 *   • All cell styles (fonts / fills / borders) via xlsx-js-style
 *   • Column widths
 *   • Print_Titles defined name
 * But does NOT yet contain freeze panes, sheet tab color, or pageSetup.
 * Call patchWorkbookXml() on the result to add those (async, uses JSZip).
 */
function buildInitialWorkbook(budget: FetchedBudget): {
  buffer: ArrayBuffer;
  tabColor: string;
  freeze: { xSplit: number; ySplit: number; topLeftCell: string };
} {
  const { rows, layout } = buildRowsAndLayout(budget);
  const ws = XLSX.utils.aoa_to_sheet(rows);

  applyFormulasAndStyles(ws, layout);
  applyWorksheetSettings(ws, layout);

  const wb = XLSX.utils.book_new();
  const sheetName = `${budget.year} Budget`.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Print titles (repeat header row 2 at top of every printed page) —
  // workbook-level Names entry is honoured by xlsx-js-style.
  const sheetMeta = (wb.Workbook = wb.Workbook || { Sheets: [] });
  sheetMeta.Sheets = sheetMeta.Sheets || [];
  sheetMeta.Sheets[0] = {
    ...(sheetMeta.Sheets[0] || {}),
    name: sheetName,
    Hidden: 0,
  };
  sheetMeta.Names = sheetMeta.Names || [];
  sheetMeta.Names.push({
    Name: "_xlnm.Print_Titles",
    Sheet: 0,
    Ref: `'${sheetName}'!$${XLSX.utils.encode_row(layout.headerRow - 1)}:$${XLSX.utils.encode_row(layout.headerRow - 1)}`,
  });

  const buffer = XLSX.write(wb, {
    type: "array",
    bookType: "xlsx",
    cellStyles: true,
  }) as ArrayBuffer;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wsAny = ws as any;
  return {
    buffer,
    tabColor: wsAny.__fcTabColor as string,
    freeze: wsAny.__fcFreeze as {
      xSplit: number;
      ySplit: number;
      topLeftCell: string;
    },
  };
}

/**
 * Public export used by the Spreadsheet Editor's "Export .xlsx" button.
 * Kept sync from the caller's perspective — it immediately returns and
 * the async ZIP patch runs in the background, invoking the download as
 * soon as the patch finishes. Errors surface via console (the caller
 * can't catch them) because the existing call site is synchronous.
 */
export function exportBudgetToXlsxAndDownload(budget: FetchedBudget): void {
  if (typeof window === "undefined") {
    throw new Error("exportBudgetToXlsxAndDownload must run in the browser");
  }

  const { buffer, tabColor, freeze } = buildInitialWorkbook(budget);

  // Kick off the async patch → download chain. We don't block the click
  // handler because the consuming page uses a sync callback.
  patchWorkbookXml(buffer, tabColor, freeze)
    .then((patched) => {
      const blob = new Blob([patched], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(
        `${budget.assetName} — ${budget.year} Budget.xlsx`
      );
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[budget-export] Download failed:", err);
    });
}

/**
 * Build the fully-styled workbook. Async because the post-write XML
 * patch (freeze panes, tab color, page setup) uses JSZip. Exposed for
 * tests and verification tooling.
 */
export async function buildBudgetWorkbook(
  budget: FetchedBudget
): Promise<ArrayBuffer> {
  const { buffer, tabColor, freeze } = buildInitialWorkbook(budget);
  return patchWorkbookXml(buffer, tabColor, freeze);
}

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
}
