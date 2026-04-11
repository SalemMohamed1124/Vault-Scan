import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebarProvider } from "@/Contexts/AppSidebarContext";
import AppHeader from "@/components/layout/AppHeader";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AIChatWidgetWrapper } from "@/components/layout/AIChatWidgetWrapper";
import AppLayoutClient from "./AppLayoutClient";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* Our own lightweight sidebar state context */}
      <AppSidebarProvider>
        <div className="flex flex-1 flex-col h-svh min-w-0 bg-background overflow-hidden">
          {/* Fixed top header */}
          <AppHeader />

          {/* Body row: sidebar + scrollable content */}
          <AppLayoutClient>
            {children}
          </AppLayoutClient>

          <CommandPalette />
          <AIChatWidgetWrapper />
        </div>
      </AppSidebarProvider>
    </SidebarProvider>
  );
}
