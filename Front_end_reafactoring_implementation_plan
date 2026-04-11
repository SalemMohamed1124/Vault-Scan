# Modular UI & Architectural Alignment — Implementation Plan

Refactor the `frontend` (Next.js) project to match the modular feature architecture and UI style of the `MyFrontEnd` (Vite+React) reference project. Keep all existing API endpoints and business logic while migrating the code into a scalable, modular file structure with Zod-validated forms, responsive DataTable, and Customized layout components.

## User Review Required

> [!IMPORTANT]
> **Framework mismatch**: `frontend` is **Next.js** (server-side routing, `"use client"` directives, `next-themes`), while `MyFrontEnd` is **Vite+React** (client-side with `react-router`, custom ThemeProvider). We will adapt the MyFrontEnd patterns to work within Next.js—keeping the Next.js router/layouts but adopting the modular folder structure, DataTable system, and UI components.

> [!WARNING]
> **AI features**: `frontend` has AI-specific components (`AIChatWidget`, `AIInsightsCard`, `AIRemediationModal`, `RiskGauge`, `AIAnalysisCard`) that don't exist in `MyFrontEnd`. These will be kept and integrated into the new modular structure as `Features/AI/`.

> [!IMPORTANT]
> **The `globals.css` has 730 lines of polished styles**. We will migrate to the MyFrontEnd Tailwind v4 token system (0px radius, `--font-inter`, green primary `#36D071`) while preserving the frontend's custom utility classes (glass-card, severity badges, gradient cards, animations) that add visual depth.

---

## Proposed Changes

### Dependencies & Config

#### [MODIFY] [package.json](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/package.json)
Add these missing dependencies required by MyFrontEnd patterns:
- `zod` (form validation)
- `react-hook-form` + `@hookform/resolvers` (form management)
- `date-fns` (date formatting in columns/cards)

---

### Phase 1: Foundation — Contexts, DataTable, Customized Components

#### [NEW] [ConfirmModalContext.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/Contexts/ConfirmModalContext.tsx)
Port from MyFrontEnd. Adapt to use Next.js-compatible Dialog/Button from existing `components/ui/`.

#### [NEW] [ViewModalContext.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/Contexts/ViewModalContext.tsx)
Port from MyFrontEnd. Used for detail view & form modals.

#### [NEW] [SortFilterModalContext.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/Contexts/SortFilterModalContext.tsx)
Port from MyFrontEnd. Provides TanStack Table sort/filter state management.

#### [MODIFY] [providers.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/components/providers.tsx)
Wrap existing providers with `ConfirmContextProvider` and `ViewModalContextProvider`. Keep `next-themes` ThemeProvider (it already does what the MyFrontEnd ThemeContext does, but for Next.js).

#### [NEW] [DataTable.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/components/DataTable/DataTable.tsx)
Port the entire DataTable system (10 files) from MyFrontEnd:
- `DataTable.tsx`, `DataTableToolbar.tsx`, `DataTablePagination.tsx`
- `DataTableColumnHeader.tsx`, `DataTableColumnFilter.tsx`
- `DataTableSearchColumn.tsx`, `DataTableFilterBar.tsx`
- `DataTableExporter.tsx`, `DataTableViewOptions.tsx`
- `DataTableSortFilterModal.tsx`

Adapt imports for Next.js path aliases and existing UI components.

#### [NEW] [useDataTable.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/hooks/useDataTable.tsx)
Port from MyFrontEnd `Hooks/useDataTable.tsx`.

#### [NEW] Customized component ports (`src/components/Customized/`)
- `mobile-card.tsx` — compound component for responsive mobile layouts
- `summary.tsx` — reusable stats summary cards
- `badge.tsx` — themed badge component with severity/status variants
- `detail-card.tsx` — detail view card component
- `AppBreadcrumb.tsx` — breadcrumb using Next.js `usePathname`

#### [NEW] [spinner.tsx](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/components/ui/spinner.tsx)
Port from MyFrontEnd — used by ConfirmContext and DataTable.

#### [MODIFY] [globals.css](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/src/app/globals.css)
Add MyFrontEnd's font variables (`--font-inter`, `--font-mono`, `--font-display`) and scrollbar styles to be consistent. Keep the existing rich styling (glass cards, severity badges, gradient cards, animations).

---

### Phase 2: Feature Modular Refactors

Each monolithic `page.tsx` will be deconstructed. The page files remain as thin entry points that import from the feature modules.

#### Assets Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Assets/AssetColumns.tsx` | TanStack column defs with mobile card column |
| [NEW] `src/Features/Assets/AssetsTable.tsx` | Uses the new DataTable component |
| [NEW] `src/Features/Assets/AssetMobileCard.tsx` | Responsive mobile card layout |
| [NEW] `src/Features/Assets/AssetFormSchema.ts` | Zod schema for asset creation/editing |
| [NEW] `src/Features/Assets/AssetForm.tsx` | React Hook Form + Shadcn fields |
| [NEW] `src/Features/Assets/useAssetFormModals.tsx` | ViewModalContext integration |
| [NEW] `src/Features/Assets/useAssets.tsx` | TanStack Query hook (extracted from page) |
| [NEW] `src/Features/Assets/AssetRowActions.tsx` | Edit/Delete/Scan dropdown |
| [NEW] `src/Features/Assets/AssetSummary.tsx` | Stats cards component |
| [MODIFY] `src/app/(dashboard)/assets/page.tsx` | Slim down to import `<AssetSummary />` + `<AssetsTable />` |

#### Scans Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Scans/ScanColumns.tsx` | Column defs with status badges, severity dots |
| [NEW] `src/Features/Scans/ScansTable.tsx` | DataTable wrapper |
| [NEW] `src/Features/Scans/ScanMobileCard.tsx` | Mobile card |
| [NEW] `src/Features/Scans/useScans.tsx` | TanStack Query hook |
| [NEW] `src/Features/Scans/ScanRowActions.tsx` | Row-level actions |
| [NEW] `src/Features/Scans/ScansSummary.tsx` | Stats header |
| [MODIFY] `src/app/(dashboard)/scans/page.tsx` | Slim entry point |

#### Findings Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Findings/FindingColumns.tsx` | Column defs with severity, category, selection |
| [NEW] `src/Features/Findings/FindingsTable.tsx` | DataTable wrapper |
| [NEW] `src/Features/Findings/FindingMobileCard.tsx` | Mobile card |
| [NEW] `src/Features/Findings/useFindings.tsx` | TanStack Query hook |
| [NEW] `src/Features/Findings/FindingRowActions.tsx` | Delete, view scan, AI remediation |
| [NEW] `src/Features/Findings/FindingDetailDrawer.tsx` | Slide-out detail (existing logic moved) |
| [NEW] `src/Features/Findings/FindingsSummary.tsx` | Severity summary cards |
| [MODIFY] `src/app/(dashboard)/findings/page.tsx` | Slim entry point |

#### Dashboard / Overview Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Dashboard/OverviewStats.tsx` | Hero stat cards |
| [NEW] `src/Features/Dashboard/SecurityScoreCard.tsx` | Security score ring |
| [NEW] `src/Features/Dashboard/VulnTrendChart.tsx` | Area chart |
| [NEW] `src/Features/Dashboard/ScanActivityChart.tsx` | Bar chart |
| [NEW] `src/Features/Dashboard/TopVulnerabilities.tsx` | Top vulns list |
| [NEW] `src/Features/Dashboard/RecentActivity.tsx` | Activity feed |
| [NEW] `src/Features/Dashboard/RecentScans.tsx` | Recent scans mini-table |
| [MODIFY] `src/app/(dashboard)/overview/page.tsx` | Slim composition |

#### Schedules Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Schedules/ScheduleColumns.tsx` | Column defs |
| [NEW] `src/Features/Schedules/SchedulesTable.tsx` | DataTable wrapper |
| [NEW] `src/Features/Schedules/ScheduleMobileCard.tsx` | Mobile card |
| [NEW] `src/Features/Schedules/ScheduleFormSchema.ts` | Zod schema |
| [NEW] `src/Features/Schedules/ScheduleForm.tsx` | RHF form |
| [NEW] `src/Features/Schedules/useScheduleFormModals.tsx` | Modal hooks |
| [NEW] `src/Features/Schedules/useSchedules.tsx` | Query hook |
| [MODIFY] `src/app/(dashboard)/schedules/page.tsx` | Slim entry point |

#### Notifications Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Notifications/NotificationColumns.tsx` | Column defs |
| [NEW] `src/Features/Notifications/NotificationsTable.tsx` | DataTable wrapper |
| [NEW] `src/Features/Notifications/NotificationMobileCard.tsx` | Mobile card |
| [NEW] `src/Features/Notifications/useNotifications.tsx` | Query hook |
| [MODIFY] `src/app/(dashboard)/notifications/page.tsx` | Slim entry point |

#### Reports Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Reports/ReportColumns.tsx` | Column defs |
| [NEW] `src/Features/Reports/ReportsTable.tsx` | DataTable wrapper |
| [NEW] `src/Features/Reports/ReportMobileCard.tsx` | Mobile card |
| [NEW] `src/Features/Reports/useReports.tsx` | Query hook |
| [MODIFY] `src/app/(dashboard)/reports/page.tsx` | Slim entry point |

#### AI Feature (Existing, Reorganize)
| File | Description |
|------|-------------|
| [NEW] `src/Features/AI/` | Move existing `components/ai/*` into feature folder |

#### Settings Feature
| File | Description |
|------|-------------|
| [NEW] `src/Features/Settings/SettingsForm.tsx` | Form component |
| [MODIFY] `src/app/(dashboard)/settings/page.tsx` | Slim entry point |

---

### Phase 3: Type Safety & Zod Schemas

- Create `src/Features/Assets/AssetFormSchema.ts` with `z.object` for create/edit
- Create `src/Features/Schedules/ScheduleFormSchema.ts` with `z.object` for create/edit  
- Eliminate all `any` casts (e.g., `(finding as any).scan?.asset` in findings page)
- Use `z.infer<typeof schema>` for form types throughout

---

## Verification Plan

### Build Verification
```bash
cd c:\Users\Salem\Desktop\AI-vulnerability-scanner-main\frontend
npm run build
```
Must complete with zero TypeScript errors and zero `any` usage in new code.

### Existing E2E Tests
The project has Playwright e2e tests in [app.spec.ts](file:///c:/Users/Salem/Desktop/AI-vulnerability-scanner-main/frontend/e2e/app.spec.ts) covering:
- Landing page display
- Authentication (login, register, invalid credentials)
- Dashboard overview stats, AI Insights, Security Score
- Assets page display
- Scans page display + "Start New Scan" button
- AI Chat Widget
- Navigation between pages via sidebar
- Settings, Notifications, Reports page display

```bash
cd c:\Users\Salem\Desktop\AI-vulnerability-scanner-main\frontend
npx playwright test
```

> [!NOTE]
> These tests require a running backend. The actual verification during development will primarily be `npm run build` for correctness and visual inspection via `npm run dev` for UI consistency.

### Manual Verification
After the refactor, the user should:
1. Run `npm run dev` and navigate to each page (Overview, Assets, Scans, Findings, Schedules, Notifications, Reports, Settings)
2. Verify each page renders with data tables, search, filter, sort functioning
3. Resize to mobile viewport and confirm the MobileCard pattern kicks in
4. Test Add/Edit/Delete flows on Assets and Schedules
5. Confirm light/dark theme toggle still works
