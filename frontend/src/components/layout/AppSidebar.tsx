"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  LogOut,
  BadgeCheck,
  ArrowRightLeft,
  Check,
  Sun,
  Moon,
  Monitor,
  Shield,
  ChevronDown,
  Plus,
  Upload,
  Play,
  CalendarClock,
  FileText,
  Bell,
  Settings,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";

import { useAppSidebar } from "@/Contexts/AppSidebarContext";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/hooks/useOrg";
import { useTheme } from "next-themes";

import { useAssetFormModals } from "@/Features/assets/useAssetFormModals";
import { useScanFormModals } from "@/Features/scans/useScanFormModals";
import { useScheduleFormModals } from "@/Features/schedule/useScheduleFormModals";
import { useReportFormModals } from "@/Features/reports/useReportFormModals";
import { NAV_LINKS } from "@/Constants/NAV_LINKS";

// ─────────────────────────────────────────────────────────
// Main — Mini Sidebar (Desktop) + Floating Overlay
// ─────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────
// Main — Mini Sidebar (Desktop) + Floating Overlay
// ─────────────────────────────────────────────────────────
export default function AppSidebar() {
  const { isOpen, close, isMobile } = useAppSidebar();
  const pathname = usePathname();

  return (
    <>
      {/* ── Mini Sidebar for Desktop ── */}
      {!isMobile && (
        <aside className="w-[72px] shrink-0 flex flex-col items-center bg-background z-10 py-3 gap-1 overflow-y-auto no-scrollbar">
          {NAV_LINKS.flatMap((s) => s.items).map((item) => {
            const isActive =
              pathname === item.link ||
              (item.link !== "/overview" && pathname.startsWith(item.link));
            const Icon = item.icon;

            return (
              <Link
                key={item.link}
                href={item.link}
                className={[
                  "flex flex-col items-center justify-center gap-1.5 w-[64px] py-3.5 rounded-xl transition-colors duration-150 text-[10px]",
                  isActive
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon
                  className={`size-[22px] ${
                    isActive ? "text-primary" : "text-muted-foreground/80"
                  }`}
                />
                <span className="truncate w-full text-center px-1">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </aside>
      )}

      {/* ── Backdrop — click to close ── */}
      <div
        onClick={close}
        className={[
          "fixed inset-0 z-40 transition-all duration-300",
          isOpen
            ? "bg-black/40 backdrop-blur-[2px] pointer-events-auto"
            : "bg-transparent pointer-events-none",
        ].join(" ")}
        aria-hidden="true"
      />

      {/* ── Floating sidebar panel ── */}
      <aside
        className={[
          // Positioning — floats over content, starts below the header (top-14)
          "fixed top-14 left-0 bottom-0 z-50 w-64",
          // Appearance — same bg as app, glass-like with shadow
          "flex flex-col bg-background/95 backdrop-blur-md",
          "shadow-2xl shadow-black/30",
          // Slide animation
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Nav items */}
        <ScrollArea className="flex-1 overflow-x-hidden">
          <nav className="py-3 px-3">
            {NAV_LINKS.map((section, si) => (
              <SectionGroup key={si} section={section} />
            ))}
            <SidebarQuickActions />
          </nav>
        </ScrollArea>

        {/* Footer */}
        <SidebarFooter />
      </aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Section group
// ─────────────────────────────────────────────────────────
function SectionGroup({ section }: { section: (typeof NAV_LINKS)[number] }) {
  const pathname = usePathname();
  const { close } = useAppSidebar();

  return (
    <div className="mb-1">
      {section.group && (
        <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
          {section.group}
        </p>
      )}

      {section.items.map((item) => {
        const isActive =
          pathname === item.link ||
          (item.link !== "/overview" && pathname.startsWith(item.link));
        const Icon = item.icon;

        return (
          <Link
            key={item.link}
            href={item.link}
            onClick={close}
            className={[
              "group flex items-center gap-3.5 w-full px-4 py-2.5 rounded-xl",
              "text-[14px] font-medium transition-colors duration-150",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            <Icon
              className={[
                "size-[18px] shrink-0 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground/70 group-hover:text-foreground",
              ].join(" ")}
            />
            <span className="truncate leading-none">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Quick Actions
// ─────────────────────────────────────────────────────────
function SidebarQuickActions() {
  const { close } = useAppSidebar();
  const { openCreateModal: openAddAsset, openBulkCreateModal } = useAssetFormModals();
  const { openCreateModal: openStartScan } = useScanFormModals();
  const { openNew: openNewSchedule } = useScheduleFormModals();
  const { openGenerate: openGenerateReport } = useReportFormModals();

  const actions = [
    { label: "Add Asset", icon: Plus, iconColor: "text-blue-500" },
    { label: "Bulk Import", icon: Upload, iconColor: "text-indigo-500" },
    { label: "Start Scan", icon: Play, iconColor: "text-primary" },
    { label: "New Schedule", icon: CalendarClock, iconColor: "text-emerald-500" },
    { label: "Generate Report", icon: FileText, iconColor: "text-amber-500" },
  ];

  const handleAction = (label: string) => {
    switch (label) {
      case "Add Asset": openAddAsset(); break;
      case "Bulk Import": openBulkCreateModal(); break;
      case "Start Scan": openStartScan(); break;
      case "New Schedule": openNewSchedule(); break;
      case "Generate Report": openGenerateReport(); break;
    }
    close();
  };

  return (
    <div className="mb-1 mt-2">
      <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 select-none">
        Quick Actions
      </p>

      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => handleAction(action.label)}
            className={[
              "group flex items-center gap-3.5 w-full px-4 py-2.5 rounded-xl text-left",
              "text-[14px] font-medium transition-colors duration-150",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
            ].join(" ")}
          >
            <Icon
              className={[
                "size-[18px] shrink-0 transition-colors",
                action.iconColor,
              ].join(" ")}
            />
            <span className="truncate leading-none">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Footer — user profile
// ─────────────────────────────────────────────────────────
function SidebarFooter() {
  const { user, logout } = useAuth();
  const { organizations, activeOrgId, switchOrg } = useOrg();
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const { close, isMobile } = useAppSidebar();
  const [open, setOpen] = useState(false);

  const userInitials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "VS";

  return (
    <div className="border-t border-border/50 p-2 shrink-0">
      <DropdownMenu open={open} onOpenChange={setOpen} modal={isMobile}>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted cursor-pointer outline-none">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary ring-1 ring-primary/20">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                {user?.name ?? "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {user?.email ?? ""}
              </p>
            </div>
            <ChevronDown className="size-4 text-muted-foreground/50 shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          className="w-60 rounded-xl border border-border bg-popover p-2 shadow-2xl"
        >
          {/* User info */}
          <div className="flex items-center gap-3 px-2 py-2 mb-1">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary ring-1 ring-primary/20">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{user?.name ?? "User"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email ?? ""}</p>
            </div>
          </div>

          <DropdownMenuSeparator className="my-1" />

          {/* Organization switcher */}
          <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
            <ArrowRightLeft className="size-3" /> Switch Organization
          </div>
          <ScrollArea className="h-36 my-1">
            <RadioGroup value={activeOrgId} onValueChange={switchOrg}>
              {(organizations ?? []).map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  className="p-0 focus:bg-transparent"
                  onSelect={(e) => {
                    e.preventDefault();
                    switchOrg(org.id);
                    setTimeout(() => close(), 100);
                  }}
                >
                  <label
                    htmlFor={`org-${org.id}`}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-primary border border-border">
                      {org.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="truncate text-xs font-semibold text-foreground">{org.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{org.role}</p>
                    </div>
                    <RadioGroupItem id={`org-${org.id}`} value={org.id} className="peer sr-only" />
                    <Check className="size-3.5 text-primary opacity-0 peer-data-[state=checked]:opacity-100" />
                  </label>
                </DropdownMenuItem>
              ))}
            </RadioGroup>
          </ScrollArea>

          <DropdownMenuSeparator className="my-1" />

          {/* Appearance */}
          <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Appearance
          </div>
          <DropdownMenuGroup className="px-1 pb-1">
            {[
              { label: "Light", value: "light", icon: Sun },
              { label: "Dark",  value: "dark",  icon: Moon },
              { label: "System",value: "system",icon: Monitor },
            ].map(({ label, value, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className="flex items-center justify-between text-xs cursor-pointer rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground"
              >
                <div className="flex items-center gap-2"><Icon className="size-3.5" /> {label}</div>
                {theme === value && <Check className="size-3.5 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <DropdownMenuGroup className="px-1 py-1">
            <DropdownMenuItem className="gap-2 text-xs rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => { router.push("/notifications"); setOpen(false); close(); }}>
              <Bell className="size-3.5" /> Notifications
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground cursor-pointer" onClick={() => { router.push("/settings"); setOpen(false); close(); }}>
              <Settings className="size-3.5" /> Workspace Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1" />

          <div className="px-1 pt-1">
            <DropdownMenuItem
              className="gap-2 text-xs rounded-lg px-2 py-2 text-red-500 hover:bg-red-500/5 hover:text-red-600 cursor-pointer"
              onClick={logout}
            >
              <LogOut className="size-3.5" /> Log out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
