import { Shield } from "lucide-react";
import { SidebarTrigger } from "../ui/sidebar";
import AppBreadcrumb from "./AppBreadcrumb";
import { ModeToggle } from "./mode-toggle";

function AppHeader() {
  return (
    <header className="flex h-10 items-center justify-between border-b border-border bg-sidebar shrink-0 ">
      {/* Left Section */}
      <div className="flex items-center gap-1">
        <div className="flex w-12 items-center justify-center shrink-0 border-r border-border">
          <SidebarTrigger className="border border-border rounded-md" />
        </div>

        <div className="flex items-center gap-2 px-2">
          <Shield className="size-5 text-blue-400 shrink-0" />
          {/* <span className="font-semibold text-sm hidden sm:inline">VulnScanner</span> */}
        </div>

        <AppBreadcrumb />
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1 px-2">
        <ModeToggle />
      </div>
    </header>
  );
}

export default AppHeader;
