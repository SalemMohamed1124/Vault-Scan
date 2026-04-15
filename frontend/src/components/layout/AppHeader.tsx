"use client";

import { useRouter } from "next/navigation";
import {
  Shield,
  Bell,
  Search,
  LogOut,
  Settings,
  Menu,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import Link from "next/link";

import { useAppSidebar } from "@/Contexts/AppSidebarContext";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { ModeToggle } from "./ModeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─────────────────────────────────────────────────────────
// AppHeader — transparent / same-bg-as-app, floating feel
// ─────────────────────────────────────────────────────────
function AppHeader() {
  const { toggle, isMobile } = useAppSidebar();
  const { user, logout } = useAuth();
  const { setTheme, theme } = useTheme();
  const router = useRouter();

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "VS";

  return (
    <header className="flex h-14 items-center justify-between pr-3 bg-background shrink-0 z-50">
      {/* ── Left: hamburger + logo ── */}
      <div className="flex items-center shrink-0">
        <div className="w-[72px] flex items-center justify-center shrink-0">
          <button
            onClick={toggle}
            className="flex items-center justify-center size-9 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Toggle sidebar"
          >
            <Menu className="size-5" />
          </button>
        </div>

        <Link
          href="/overview"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Shield className="size-5 text-primary shrink-0" />
          <span className="font-bold text-[15px] tracking-tight text-foreground hidden sm:inline">
            VaultScan
          </span>
        </Link>
      </div>

      {/* ── Center: search (desktop) ── */}
      {!isMobile && (
        <div className="flex-1 max-w-xl">
          <button
            onClick={() =>
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
              )
            }
            className="group flex items-center w-full gap-2.5 h-9 px-4  bg-muted/60 border border-border/50 hover:bg-muted hover:border-border transition-all cursor-text text-left"
          >
            <Search className="size-4 text-muted-foreground shrink-0 transition-colors" />
            <span className="flex-1 text-sm text-muted-foreground">
              Search…
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="inline-flex h-5 items-center rounded bg-background/80 px-1.5 font-mono text-[10px] text-muted-foreground border border-border/50">
                Ctrl
              </kbd>
              <kbd className="inline-flex h-5 items-center rounded bg-background/80 px-1.5 font-mono text-[10px] text-muted-foreground border border-border/50">
                K
              </kbd>
            </div>
          </button>
        </div>
      )}

      {/* ── Right: actions ── */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Mobile: search icon */}
        {isMobile && (
          <button
            onClick={() =>
              document.dispatchEvent(
                new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
              )
            }
            className="flex items-center justify-center size-9 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label="Search"
          >
            <Search className="size-5" />
          </button>
        )}

        {/* Theme toggle */}
        <ModeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center size-9 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
              <Bell className="size-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-80 p-0 rounded-xl border border-border bg-popover shadow-xl"
          >
            <div className="flex items-center p-4 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">
                Notifications
              </h3>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Bell className="size-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                No notifications yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                You're all caught up!
              </p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center size-9 rounded-full bg-primary/10 text-[11px] font-bold text-primary ring-1 ring-primary/20 hover:ring-primary/40 hover:bg-primary/20 transition-all cursor-pointer ml-1 outline-none">
              {userInitials}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-52 rounded-xl border border-border bg-popover p-2 shadow-xl mt-1"
          >
            <div className="px-2 py-2 mb-1">
              <p className="text-[13px] font-semibold text-foreground truncate">
                {user?.name ?? "User"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {user?.email ?? ""}
              </p>
            </div>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              className="gap-2 text-xs rounded-lg px-2 py-2 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => router.push("/settings")}
            >
              <Settings className="size-3.5" /> Workspace Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              className="gap-2 text-xs rounded-lg px-2 py-2 text-red-500 hover:bg-red-500/5 hover:text-red-600 focus:bg-red-500/5 cursor-pointer"
              onClick={logout}
            >
              <LogOut className="size-3.5" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default AppHeader;
