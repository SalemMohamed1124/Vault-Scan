import { DataTable } from "@/components/DataTable/DataTable";
import useNotifications from "./useNotifications";
import { NotificationColumns } from "./NotificationColumns";
import { useNotification } from "./useNotification";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Check } from "lucide-react";

function NotificationsTable() {
  const { notifications = [], isPending, error } = useNotifications();

  return (
    <DataTable
      tableName="NotificationsTable"
      data={notifications || []}
      columns={NotificationColumns}
      isLoading={isPending}
      error={error}
      cardsLayout={true}
      disablePagination={true}
      toolbar={{
        search: true,
        export: false,
        filter: true,
        viewOptions: false,
      }}
      extraActions={<MarkAllAsReadButton />}
    />
  );
}

export default NotificationsTable;

function MarkAllAsReadButton() {
  const { markAllAsReadApi, isMarkAllAsReadPending } = useNotification();
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() => markAllAsReadApi()}
      disabled={isMarkAllAsReadPending}
      className="h-9 gap-2"
    >
      {isMarkAllAsReadPending ? <Spinner /> : <Check />}
      <span>Mark all as read</span>
    </Button>
  );
}
