"use client";

import { useState } from "react";
import { useOrg } from "@/hooks/useOrg";
import { cn } from "@/lib/utils";
import OrganizationTab from "./Organization/OrganizationTab";
import MembersTab from "./Members/MembersTab";
import ProfileTab from "./Profile/ProfileTab";
import { Building2, Users, User } from "lucide-react";

const SETTINGS_TABS = [
  {
    id: "organization",
    label: "Organization",
    icon: Building2,
    adminOnly: true,
  },
  { id: "members", label: "Members", icon: Users, adminOnly: true },
  { id: "profile", label: "Profile", icon: User, adminOnly: false },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export default function SettingsTabs() {
  const { isAdmin } = useOrg();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    isAdmin ? "organization" : "profile",
  );

  const visibleTabs = SETTINGS_TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b pb-1">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors relative",
                isActive
                  ? "text-primary border-b-2 border-primary -mb-px"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === "organization" && isAdmin && <OrganizationTab />}
        {activeTab === "members" && isAdmin && <MembersTab />}
        {activeTab === "profile" && <ProfileTab />}
      </div>
    </div>
  );
}
