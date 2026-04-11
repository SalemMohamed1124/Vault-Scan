"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type AppSidebarContextValue = {
  /** Whether the floating sidebar overlay is open */
  isOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  close: () => void;
};

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────
export function AppSidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  // Sidebar starts closed — it's always a floating overlay
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <AppSidebarContext.Provider value={{ isOpen, isMobile, toggle, close }}>
      {children}
    </AppSidebarContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────
export function useAppSidebar() {
  const ctx = useContext(AppSidebarContext);
  if (!ctx) throw new Error("useAppSidebar must be used within AppSidebarProvider");
  return ctx;
}
