import { fetchSchedules } from "@/Services/Schedules";
import { useQuery } from "@tanstack/react-query";

function useSchedules() {
  const {
    isPending,
    data: schedules,
    error,
  } = useQuery({
    queryKey: ["Schedules"],
    queryFn: fetchSchedules,
  });

  return { isPending, schedules, error };
}

export default useSchedules;
