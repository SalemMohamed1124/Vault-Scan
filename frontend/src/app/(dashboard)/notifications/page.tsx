import NotificationsTable from "@/Features/notifications/NotificationsTable";

export default function NotificationsPage() {
  return (
    <div className="w-full space-y-2">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <h2 className="text-muted-foreground ">Monitor and manage your notifications</h2>
      </div>
      <div className="w-full">
        <NotificationsTable />
      </div>
    </div>
  );
}
