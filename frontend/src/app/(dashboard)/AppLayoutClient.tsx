"use client";

import AppSidebar from "@/components/layout/AppSidebar";

// The sidebar is now a fixed overlay — it doesn't live in the flex flow at all.
// Main content always takes the full available width.
export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Floating sidebar — rendered in DOM here so it's inside the app context,
          but it's position:fixed so it doesn't affect layout */}
      <AppSidebar />

      {/* Main content — always full width */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-4 md:p-6 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
