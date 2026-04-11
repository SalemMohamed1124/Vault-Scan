import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Copy, Trash, Pause, Play, Power, Scan, Pencil } from "lucide-react";

import type { Schedule } from "@/Types/data-types";
import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useViewModal } from "@/Contexts/ViewModalContext";
import useSchedule from "./useSchedule";
import ScheduleDetailView from "./ScheduleDetailView";
import useScheduleFormModals from "./useScheduleFormModals";

type ScheduleRowActionsProps = {
  schedule: Schedule;
};

function ScheduleRowActions({ schedule }: ScheduleRowActionsProps) {
  const { isMobile } = useSidebar();
  const { confirm } = useConfirm();
  const { view } = useViewModal();
  const { deleteScheduleApi } = useSchedule();
  const { openEditSchedule } = useScheduleFormModals();

  function handleEdit() {
    openEditSchedule(schedule);
  }

  function handleShowMore() {
    view({
      title: "Schedule Details",
      content: <ScheduleDetailView schedule={schedule} />,
    });
  }

  function handleDelete() {
    confirm({
      title: "Delete Schedule",
      description: `Are you sure you want to delete schedule for ${schedule.asset.value}? This action cannot be undone.`,
      variant: "danger",
      confirmText: "Delete",
      onConfirm: async () => {
        await deleteScheduleApi(schedule.id);
      },
    });
  }

  if (isMobile)
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant={"outline"} onClick={handleShowMore}>
          <Eye />
          Show More
        </Button>
        {schedule.asset.type === "ip" ? (
          <Button variant={"outline"} onClick={() => toClipboard(schedule.asset.value, "Asset value copied")}>
            <Copy />
            Copy IP
          </Button>
        ) : null}
        <Button variant={"outline"} disabled={schedule.status === "running"} onClick={handleEdit}>
          <Pencil />
          Edit
        </Button>

        <Button variant={"outline"} disabled={schedule.status == "running" || schedule.status == "manual"} onClick={() => {}}>
          {schedule.status === "paused" ? <Play /> : <Pause />}
          {schedule.status === "paused" ? "Resume" : "Pause"}
        </Button>

        <Button variant={"outline"} disabled={schedule.status !== "running"}>
          <Power />
          Cancel
        </Button>
        <Button variant={"outline"} disabled={schedule.status === "running"}>
          <Scan />
          Scan Now
        </Button>
        <Button variant={"destructive"} disabled={schedule.status === "running"} onClick={handleDelete}>
          <Trash />
          Delete
        </Button>
      </div>
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>

        <DropdownMenuItem onClick={handleShowMore}>
          <Eye />
          Show Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {schedule.asset.type === "ip" ? (
          <DropdownMenuItem onClick={() => toClipboard(schedule.asset.value, "Asset value copied")}>
            <Copy />
            Copy IP
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem disabled={schedule.status === "running"} onClick={handleEdit}>
          <Pencil />
          Edit Schedule
        </DropdownMenuItem>

        <DropdownMenuItem disabled={schedule.status == "running" || schedule.status == "manual"} onClick={() => {}}>
          {schedule.status === "paused" ? <Play /> : <Pause />}
          {schedule.status === "paused" ? "Resume" : "Pause"}
        </DropdownMenuItem>

        <DropdownMenuItem disabled={schedule.status !== "running"}>
          <Power /> Cancel
        </DropdownMenuItem>
        <DropdownMenuItem disabled={schedule.status === "running"}>
          <Scan />
          Scan Now
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={schedule.status === "running"}
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash />
          Delete Schedule
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ScheduleRowActions;
