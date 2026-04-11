import { Outlet } from "react-router";
import { SidebarProvider } from "../ui/sidebar";
import AppSidebar from "./AppSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import AppHeader from "./AppHeader";

function AppLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex flex-col flex-1 h-svh">
        <AppHeader />
        <div className="flex flex-1 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <Outlet />
              </div>
            </ScrollArea>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default AppLayout;
