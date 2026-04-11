import { Outlet, NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { History, Bell } from "lucide-react";

function HistoryTabs() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b  pt-4 mb-6">
        <NavLink
          to="/history"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 pb-3 px-2 text-sm font-medium transition-all relative",
              isActive
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md"
            )
          }
        >
          <History className="size-4" />
          <span>Scan History</span>
        </NavLink>
        <NavLink
          to="/history/notifications"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 pb-3 px-2 text-sm font-medium transition-all relative",
              isActive
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md"
            )
          }
        >
          <Bell className="size-4" />
          <span>Notifications</span>
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
}

export default HistoryTabs;
