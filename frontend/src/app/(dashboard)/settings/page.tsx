"use client";

import SettingsTabs from "@/Features/settings/SettingsTabs";

export default function SettingsPage() {
  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <h2 className="text-muted-foreground">Manage your organization, team, and security settings</h2>
      </div>

      <SettingsTabs />
    </div>
  );
}
