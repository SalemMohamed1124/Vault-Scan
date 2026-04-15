"use client";

import { useUpdateSchedule, useDeleteSchedule } from "./useScheduleMutations";
import { useConfirm } from "@/Contexts/ConfirmModalContext";
import { useScheduleFormModals } from "./useScheduleFormModals";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Trash2, 
  Edit3, 
  Pause, 
  Play 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";
import type { ScanSchedule } from "@/types";

type ScheduleRowActionsProps = {
  schedule: ScanSchedule;
};

export default function ScheduleRowActions({ schedule }: ScheduleRowActionsProps) {
  const { mutateAsync: updateScheduleApi, isPending: isUpdating } = useUpdateSchedule(schedule.id);
  const { mutateAsync: deleteScheduleApi, isPending: isDeleting } = useDeleteSchedule();
  const { confirm } = useConfirm();
  const { openEdit } = useScheduleFormModals();
  const { isMobile } = useSidebar();

  const handleToggle = () => {
    updateScheduleApi({ id: schedule.id, data: { isActive: !schedule.isActive } });
  };

  const handleDelete = () => {
    confirm({
      title: "Terminate Schedule",
      description: "Permanently delete this automated scan schedule? This cannot be undone.",
      confirmText: "Terminate",
      variant: "danger",
      onConfirm: () => deleteScheduleApi(schedule.id),
    });
  };

  const handleEdit = () => {
    openEdit(schedule);
  };

  if (isMobile) {
    return (
      <div className="grid grid-cols-2 gap-2 w-full">
        <Button
          variant="outline"
          className={cn(
            "w-full text-xs gap-2 h-9",
            schedule.isActive ? "text-yellow-500 hover:text-yellow-600" : "text-emerald-500 hover:text-emerald-600"
          )}
          onClick={handleToggle}
          disabled={isUpdating}
        >
          {schedule.isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {schedule.isActive ? "Pause" : "Resume"}
        </Button>
        <Button 
          variant="outline" 
          onClick={handleEdit} 
          className="w-full text-xs gap-2 h-9"
        >
          <Edit3 className="size-3.5" />
          Edit
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          className="w-full text-xs gap-2 h-9 col-span-2"
          disabled={isDeleting}
        >
          <Trash2 className="size-3.5" />
          Terminate
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem 
          onClick={handleToggle}
          className={cn(
            "transition-colors",
            schedule.isActive ? "text-yellow-500 focus:text-yellow-600" : "text-emerald-500 focus:text-emerald-600"
          )}
        >
          {schedule.isActive ? (
            <Pause className="mr-2 h-4 w-4" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {schedule.isActive ? "Pause Schedule" : "Resume Schedule"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit}>
          <Edit3 className="mr-2 h-4 w-4" />
          Modify Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={handleDelete} 
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Terminate Schedule
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
