"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type AppSidebarContextValue = {
  isOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  close: () => void;
};

const AppSidebarContext = createContext<AppSidebarContextValue | null>(null);

export function AppSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  return (
    <AppSidebarContext.Provider value={{ isOpen, isMobile, toggle, close }}>
      {children}
    </AppSidebarContext.Provider>
  );
}

export function useAppSidebar() {
  const ctx = useContext(AppSidebarContext);
  if (!ctx)
    throw new Error("useAppSidebar must be used within AppSidebarProvider");
  return ctx;
}
