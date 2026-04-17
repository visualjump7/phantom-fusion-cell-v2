# RENAME_INVENTORY.md — `/nucleus` → `/command`

Phase 1 discovery artifact. Every case-insensitive match for `nucleus` in tracked source, organized by file type. No source files have been modified.

---

## 1. Routes & folders (`app/**`, `pages/**`)

| File | Line | Snippet |
|---|---|---|
| `app/nucleus/page.tsx` | — | **Folder rename required:** `app/nucleus/` → `app/command/` |
| `app/nucleus/page.tsx` | 4 | `/nucleus — principal-first entry point.` |
| `app/nucleus/page.tsx` | 6 | `Wraps the orbital nucleus + focused overlay in a NucleusProvider…` |
| `app/nucleus/page.tsx` | 19–24 | Imports from `@/components/nucleus/*` (will shift when components move in Phase 2) |
| `app/nucleus/page.tsx` | 28 | `export default function NucleusPage()` |
| `app/nucleus/page.tsx` | 30–32 | `<NucleusProvider>…<NucleusPageInner />…</NucleusProvider>` |
| `app/nucleus/page.tsx` | 36 | `function NucleusPageInner()` |
| `app/nucleus/page.tsx` | 41 | `const { activeModule, openModule, close } = useNucleus();` |
| `app/nucleus/page.tsx` | 78 | `console.error("[nucleus] getVisibleModulesForUser failed", err);` |
| `app/nucleus/page.tsx` | 145 | `<OrbitalNucleus` JSX |

---

## 2. Component files (`.tsx`, `.jsx`)

### 2a. Files that live under `components/nucleus/` (whole directory moves)

| File | Notes |
|---|---|
| `components/nucleus/OrbitalNucleus.tsx` | **File rename:** `OrbitalNucleus.tsx` (component, export, type `OrbitalNucleusProps`, `NucleusMode`) |
| `components/nucleus/NucleusContext.tsx` | **File rename:** context, provider, hook, value type all carry `Nucleus` |
| `components/nucleus/FocusedOverlay.tsx` | Imports `useNucleus` from `./NucleusContext` |
| `components/nucleus/WelcomeOverlay.tsx` | JSDoc only — `"…shown on top of the nucleus for principals"` |
| `components/nucleus/module-content/index.tsx` | Re-exports, no `nucleus` identifier itself |
| `components/nucleus/module-content/CalendarModule.tsx` | `import { useNucleus } from "@/components/nucleus/NucleusContext";` (lines 66, 111) |
| `components/nucleus/module-content/ContactsModule.tsx` | `useNucleus` import (lines 27, 52) |
| `components/nucleus/module-content/UnderConstructionStub.tsx` | Copy (line 14): `"Close this panel to return to the nucleus."` — **user-facing** |
| `components/nucleus/module-content/CommsModule.tsx` | **Folder path** only (imports) |
| `components/nucleus/module-content/DailyBriefModule.tsx` | **Folder path** only |
| `components/nucleus/module-content/BudgetsModule.tsx` | **Folder path** only |
| `components/nucleus/module-content/CashFlowModule.tsx` | **Folder path** only |
| `components/nucleus/module-content/ProjectsModule.tsx` | **Folder path** only |
| `components/nucleus/module-content/TravelModule.tsx` | **Folder path** only |

Planned move: `components/nucleus/` → `components/command/` (directory), with `OrbitalNucleus.tsx` → `OrbitalCommand.tsx`, `NucleusContext.tsx` → `CommandContext.tsx`.

### 2b. `OrbitalNucleus.tsx` — detailed identifier list

| Line | Snippet |
|---|---|
| 4 | `OrbitalNucleus — the principal's entry point.` |
| 25 | `export type NucleusMode = "principal" \| "admin" \| "preview";` |
| 27 | `export interface OrbitalNucleusProps {` |
| 31 | `mode?: NucleusMode;` |
| 55 | `export function OrbitalNucleus({` |
| 62 | `}: OrbitalNucleusProps) {` |
| 83 | `data-nucleus-mode={mode}` |
| 158, 162, 166, 170, 171, 174, 187 | CSS keyframe / class identifiers: `fc-nucleus-flow`, `fc-nucleus-line-fade`, `.fc-nucleus-line` |
| 443 | `export default OrbitalNucleus;` |

### 2c. `NucleusContext.tsx` — identifier list

| Line | Snippet |
|---|---|
| 4 | `NucleusContext — shared state…` |
| 31 | `export interface NucleusContextValue {` |
| 42 | `const NucleusContext = createContext<NucleusContextValue \| null>(null);` |
| 44 | `export function NucleusProvider(…)` |
| 74 | `const value = useMemo<NucleusContextValue>(` |
| 89 | `<NucleusContext.Provider value={value}>{children}</NucleusContext.Provider>` |
| 93 | `export function useNucleus(): NucleusContextValue {` |
| 94 | `const ctx = useContext(NucleusContext);` |
| 96 | `throw new Error("useNucleus must be used inside <NucleusProvider>");` |
| 107 | `const { navStack, push, pop } = useNucleus();` |

### 2d. Other component files

| File | Line | Snippet |
|---|---|---|
| `components/Navbar.tsx` | 71 | `const [nucleusOverlayOpen, setNucleusOverlayOpen] = useState(false);` |
| `components/Navbar.tsx` | 168 | `onOpenNucleus={() => setNucleusOverlayOpen(true)}` |
| `components/Navbar.tsx` | 277 | `open={nucleusOverlayOpen}` |
| `components/Navbar.tsx` | 278 | `onClose={() => setNucleusOverlayOpen(false)}` |
| `components/admin/AdminSettingsMenu.tsx` | 7 | JSDoc: `Open Nucleus (mounts NucleusOverlayHost)` |
| `components/admin/AdminSettingsMenu.tsx` | 10 | JSDoc: `Land on Nucleus / Dashboard` |
| `components/admin/AdminSettingsMenu.tsx` | 12 | JSDoc: `the actual nucleus overlay is rendered…` |
| `components/admin/AdminSettingsMenu.tsx` | 14 | JSDoc: `The menu items just call openNucleus() / activatePrincipal()` |
| `components/admin/AdminSettingsMenu.tsx` | 40 | `import { OrbitalNucleus } from "@/components/nucleus/OrbitalNucleus";` |
| `components/admin/AdminSettingsMenu.tsx` | 41 | `import { FocusedOverlay } from "@/components/nucleus/FocusedOverlay";` |
| `components/admin/AdminSettingsMenu.tsx` | 43–45 | `import { NucleusProvider, useNucleus } from "@/components/nucleus/NucleusContext";` |
| `components/admin/AdminSettingsMenu.tsx` | 46 | `import { getModuleContent } from "@/components/nucleus/module-content";` |
| `components/admin/AdminSettingsMenu.tsx` | 64, 67 | `onOpenNucleus` prop on `<AdminSettingsMenu>` |
| `components/admin/AdminSettingsMenu.tsx` | 87 | `const [landing, setLanding] = useState<DefaultLanding>("nucleus");` — **enum value; DB-constrained** (see §8) |
| `components/admin/AdminSettingsMenu.tsx` | 148 | `router.push("/nucleus");` — **route literal** |
| `components/admin/AdminSettingsMenu.tsx` | 165 | `const next: DefaultLanding = landing === "nucleus" ? "dashboard" : "nucleus";` — **enum value** |
| `components/admin/AdminSettingsMenu.tsx` | 208 | `onOpenNucleus();` |
| `components/admin/AdminSettingsMenu.tsx` | 213 | **User-facing copy:** `Open Nucleus` button label |
| `components/admin/AdminSettingsMenu.tsx` | 289 | JSDoc: `<AdminOverlayHost /> — the full-viewport nucleus overlay` |
| `components/admin/AdminSettingsMenu.tsx` | 301–303 | `<NucleusProvider><NucleusOverlay onClose={onClose} /></NucleusProvider>` |
| `components/admin/AdminSettingsMenu.tsx` | 307 | `function NucleusOverlay({ onClose }: …)` |
| `components/admin/AdminSettingsMenu.tsx` | 309 | `const { activeModule, openModule, close: closeModule } = useNucleus();` |
| `components/admin/AdminSettingsMenu.tsx` | 332 | `aria-label="Close nucleus"` — **user-facing / a11y** |
| `components/admin/AdminSettingsMenu.tsx` | 337 | `<OrbitalNucleus …` JSX |
| `components/admin/PreviewRouteGuard.tsx` | 5 | JSDoc: `dashboard-style admin route bounces to /nucleus instead.` |
| `components/admin/PreviewRouteGuard.tsx` | 31 | `router.replace("/nucleus");` — **route literal** |

---

## 3. Style files (`.css`, `.scss`, tailwind config)

- **No matches in `*.css` / `*.scss` files** — the orbital nucleus animations live inline in `OrbitalNucleus.tsx` via a `<style>` block (already captured in §2b, lines 158–174).
- **`tailwind.config.ts`**: no matches.
- `app/landing.css` and `app/globals.css`: no `nucleus` class names.

CSS class identifiers to rename (in the inline `<style>` block of `OrbitalNucleus.tsx`): `fc-nucleus-flow`, `fc-nucleus-line-fade`, `.fc-nucleus-line`.

---

## 4. Service layer & lib (`.ts`)

| File | Line | Snippet | Category |
|---|---|---|---|
| `lib/module-metadata.ts` | 22 | JSDoc: `Dashboard is always a full-route navigation away from nucleus…` | comment |
| `lib/module-visibility-service.ts` | 77 | JSDoc: `Returns the list of module keys a given user should see in their nucleus.` | comment |
| `lib/profile-service.ts` | 6 | `export type DefaultLanding = "dashboard" \| "nucleus";` | **enum value — DB-bound (§8)** |
| `lib/profile-service.ts` | 10 | JSDoc: `Nucleus; anyone who explicitly sets "dashboard" in Settings keeps that.` | comment |
| `lib/profile-service.ts` | 22 | `return "nucleus";` | **enum value** |
| `lib/profile-service.ts` | 25 | JSDoc: `Only an explicit "dashboard" overrides the nucleus default.` | comment |
| `lib/profile-service.ts` | 26 | `return data.default_landing === "dashboard" ? "dashboard" : "nucleus";` | **enum value** |
| `lib/profile-service.ts` | 31 | JSDoc: `CHECK (default_landing IN ('dashboard','nucleus')) constraint.` | **DB constraint documentation** |
| `lib/preview-context.tsx` | 8 | JSDoc: `/dashboard and other admin-only routes redirect to /nucleus` | comment |
| `middleware.ts` | 75 | Comment: `Principals (executive) are nucleus-first by design…` | comment |
| `middleware.ts` | 76 | Comment: `"/nucleus" unconditionally.` | comment |
| `middleware.ts` | 78 | Comment: `Team members…also default to "/nucleus" on first login.` | comment |
| `middleware.ts` | 83 | `return NextResponse.redirect(new URL("/nucleus", request.url));` | **route literal** |
| `middleware.ts` | 91 | `const target = profile?.default_landing === "dashboard" ? "/dashboard" : "/nucleus";` | **route literal** |

---

## 5. Database migrations, seed files, SQL

**No `nucleus` references in `sql/*.sql` migrations.** Nothing to rename in checked-in SQL.

⚠️ **Flagged — DB CHECK constraint exists but is not in-repo:**
- `lib/profile-service.ts:31` documents a DB-side constraint: `CHECK (default_landing IN ('dashboard','nucleus'))`.
- The migration that creates this constraint is **not** in `sql/`. It was applied directly to the Supabase project or lives outside tracked migrations.
- **Phase 2/3 must include a new SQL migration** that either (a) widens the constraint to `('dashboard','command','nucleus')` temporarily, then (b) updates existing rows `'nucleus'` → `'command'`, then (c) tightens the constraint back to `('dashboard','command')`. Running the code change without the DB migration will make every `UPDATE profiles SET default_landing='command'` fail the constraint.
- Also: seed/demo data — no `nucleus` strings found in `scripts/seed-demo-principal.ts` or `scripts/reset-demo-principal.ts`; however, the seed file probably writes `default_landing` and should be re-checked during Phase 4.

---

## 6. Config files

- `next.config.js`: no matches.
- `tailwind.config.ts`: no matches.
- `postcss.config.js`: no matches.
- `package.json`: no matches.

No config-level rename work.

---

## 7. Tests

- No app-level tests exist in this repo (`*.test.ts`, `*.spec.ts` only found under `node_modules/`).
- **Nothing to rename in the test tier.**

---

## 8. User-facing copy (separated from code references)

These are strings the principal/admin will actually see. Each needs a **rewrite**, not a mechanical swap, per the prompt's "Copy rewrite notes" section.

| File | Line | Current copy | Notes |
|---|---|---|---|
| `components/admin/AdminSettingsMenu.tsx` | 213 | `Open Nucleus` (menu item label) | → `Open Command` — reads fine as bare noun |
| `components/admin/AdminSettingsMenu.tsx` | 332 | `aria-label="Close nucleus"` | → `aria-label="Close Command"` — a11y string |
| `components/nucleus/module-content/UnderConstructionStub.tsx` | 14 | `Close this panel to return to the nucleus.` | → `Close this panel to return to Command.` (bare noun; no article) |
| `app/settings/page.tsx` | 343 | `Where you land after logging in. Dashboard is the full admin view; Nucleus is the principal-first orbital view.` | → `…Command is the principal-first orbital view.` |
| `app/settings/page.tsx` | 362, 365, 368, 370 | Radio card labeled `Nucleus` as a landing option | Card title text + `onClick("nucleus")` handler both change |
| `app/admin/onboard-principal/page.tsx` | 224 | `"The person who will log in to the nucleus."` | → `"The person who will log in to Command."` |
| `app/admin/onboard-principal/page.tsx` | 235 | `"Which modules appear on their nucleus. You can change this later."` | → `"Which modules appear on their Command view. You can change this later."` (awkward without modifier — uses "Command view" per prompt guidance) |
| `app/admin/client/[orgId]/principal-experience/page.tsx` | 6 | JSDoc + copy: `Admin checks/unchecks which modules appear on the principal's nucleus.` | comment — keep in sync |
| `app/admin/client/[orgId]/principal-experience/page.tsx` | 11 | JSDoc: `routes to /nucleus.` | comment + route |
| `app/admin/client/[orgId]/principal-experience/page.tsx` | 159 | `router.push("/nucleus");` | **route literal** |
| `app/admin/client/[orgId]/principal-experience/page.tsx` | 185 | `Choose which modules appear on each principal's nucleus. Dashboard and Comms are always enabled —` | → `…appear on each principal's Command view. Dashboard and Alerts are always enabled —` (**also violates terminology rule**: `Comms` should already be `Alerts` per the rules; existing bug to flag) |

---

## 9. Static / marketing site (`fusioncell-site/`)

| File | Line | Snippet |
|---|---|---|
| `fusioncell-site/index.html` | 7 | `<meta name="description" content="Fusion Cell — a living nucleus for directors and managers, with every module one breath away." />` |

⚠️ **Flagged ambiguous — scope question:** The prompt says *"Marketing site (phantomfusioncell.com) — separate repo, handled separately."* But `fusioncell-site/` is a **subfolder inside this repo**, not a separate repo. Two possible interpretations:

1. The subfolder is a local copy / mirror of the marketing site and should be left alone.
2. It's a first-party in-repo landing page (the meta description uses "nucleus" metaphorically — "living nucleus" — which is poetic, not the page name).

**Recommendation:** leave `fusioncell-site/index.html` untouched unless the user explicitly wants it changed. The "living nucleus" phrasing is brand metaphor, not the page-name "Nucleus" this rename targets. Awaiting confirmation before touching.

---

## 10. Analytics events / audit log action types

- No hits for `nucleus.viewed`, `nucleus_viewed`, or any action type string keyed on `nucleus`.
- `audit_log` inserts in `lib/preview-context.tsx`, `app/api/admin/onboard-principal/route.ts`, and `supabase/functions/calendar-sync/index.ts` don't reference nucleus.
- **Nothing to rename in the analytics/audit tier.**

---

## 11. Ambiguous references flagged for human review

| Location | Ambiguity |
|---|---|
| `fusioncell-site/index.html:7` | "a living nucleus" — brand metaphor vs page name. See §9. |
| `lib/profile-service.ts` + DB | `'nucleus'` is a DB enum value behind a CHECK constraint. Renaming requires a coordinated SQL migration (see §5). |
| `app/settings/page.tsx:343` | Copy says *"Nucleus is the principal-first orbital view."* — this is describing the page. Rewrite needed but also confirms the "orbital view" framing should survive the rename. |
| `components/Navbar.tsx:71,168,277,278` | `nucleusOverlayOpen` state/prop and `onOpenNucleus` — these name the admin overlay that hosts the orbital layout. The visual itself (the central pulsing orb) stays; the state identifier renames. |
| `components/nucleus/OrbitalNucleus.tsx` | Component is named after the visual (central "nucleus" orb). Prompt says *leave the orb visual alone unless its component name has 'nucleus' — in which case rename it.* This component name DOES contain 'nucleus', so **rename applies** (→ `OrbitalCommand.tsx` / `OrbitalCommand`). CSS animation names (`fc-nucleus-flow`, etc.) are internal and also rename. |

---

## 12. Not-in-scope / explicit exclusions (no action)

- **Nexus Cell repo** — not this repo, untouched.
- **`node_modules/`** — all test-file hits are in third-party packages (`tsconfig-paths`, `maplibre-gl-style-spec`, etc.); ignored.
- **`.next/` build output** — ignored; regenerates on build.
- **`.git/refs/heads/colorizing-the-landing-page-nucleus`** — git branch name; not a source file; ignored (rename the branch separately if desired).
- **The orbital orb visual itself** — per prompt, leave the visual alone. The component name renames but the visual treatment (pulsing green core, orbital lines) stays.

---

## Summary counts

| Category | Files | Line matches |
|---|---|---|
| Routes / folders | 1 file (folder + 10 lines) | 10 |
| Components | 17 files | ~55 |
| Styles | 0 standalone files (inline in `OrbitalNucleus.tsx`) | 7 CSS identifiers |
| Lib / services | 5 files | 14 |
| SQL migrations | 0 in-repo (⚠️ DB constraint exists, see §5) | 0 |
| Config | 0 | 0 |
| Tests | 0 | 0 |
| User-facing copy | 5 files | 11 strings |
| Static / marketing | 1 file (ambiguous, §9) | 1 |
| Analytics / audit | 0 | 0 |

**Total tracked references:** ~98 line-level occurrences across 20 source files, plus one folder rename, plus one out-of-repo SQL migration.

---

## Phase 1 verification checklist

- [x] `RENAME_INVENTORY.md` exists at repo root
- [x] Report includes all file-type categories (routes, components, styles, services, SQL, config, tests, docs)
- [x] Every match includes file path and line number
- [x] Ambiguous references explicitly flagged (§11, also §9)
- [x] User-facing copy separated from code references (§8)
- [x] No source files modified in this phase

**Phase 1 complete. Awaiting confirmation before proceeding to Phase 2 (route & file structure).**
