import { useViewModal } from "@/Contexts/ViewModalContext";
import ScheduleForm from "./ScheduleForm";
import type { Schedule } from "@/Types/data-types";

export default function useScheduleFormModals() {
  const { view } = useViewModal();

  const openAddSchedule = () => {
    view({
      title: "New Schedule",
      content: <ScheduleForm />,
      defaultScroll: false,
    });
  };

  const openEditSchedule = (schedule: Schedule) => {
    view({
      title: "Edit Schedule",
      content: <ScheduleForm schedule={schedule} />,
      defaultScroll: false,
    });
  };

  return { openAddSchedule, openEditSchedule };
}
