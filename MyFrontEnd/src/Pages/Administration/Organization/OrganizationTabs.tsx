import { Outlet, NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { Users, UserPlus } from "lucide-react";

function OrganizationTabs() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 border-b  pt-4 mb-6">
        <NavLink
          to="/organization"
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
          <Users className="size-4" />
          <span>Members</span>
        </NavLink>
        <NavLink
          to="/organization/invitations"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 pb-3 px-2 text-sm font-medium transition-all relative",
              isActive
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-t-md"
            )
          }
        >
          <UserPlus className="size-4" />
          <span>Invitations</span>
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
}

export default OrganizationTabs;
