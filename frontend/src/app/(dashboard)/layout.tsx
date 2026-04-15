import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebarProvider } from "@/Contexts/AppSidebarContext";
import AppHeader from "@/components/layout/AppHeader";
import AppSidebar from "@/components/layout/AppSidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { AIChatWidgetWrapper } from "@/components/layout/AIChatWidgetWrapper";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebarProvider>
        <div className="flex flex-1 flex-col h-svh min-w-0 bg-background overflow-hidden">
          <AppHeader />
          <div className="flex flex-1 overflow-hidden relative">
            <AppSidebar />
            <main className="flex-1 overflow-y-auto overflow-x-hidden">
              <div className="p-4 md:p-6 min-h-full">{children}</div>
            </main>
          </div>
          <CommandPalette />
          <AIChatWidgetWrapper />
        </div>
      </AppSidebarProvider>
    </SidebarProvider>
  );
}
