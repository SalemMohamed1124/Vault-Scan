// AddScheduleProvider.tsx
import { createContext, useContext, useState } from "react";
import { format } from "date-fns";
import { useViewModal } from "@/Contexts/ViewModalContext";
import useAssets from "../Assets/useAssets";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScheduleFormSchema, type ScheduleFormValues } from "./ScheduleFormSchema";
import { combineDateAndTime } from "@/lib/utils";
import useSchedules from "./useSchedules";
import { toast } from "sonner";
import type {
  Control,
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
  UseFormWatch,
  UseFormSetValue,
  UseFormReset,
} from "react-hook-form";
import type { Asset, Schedule } from "@/Types/data-types";
import useSchedule from "./useSchedule";

type ScheduleFormContextProps = {
  close: () => void;
  editMode: boolean;
  assets: Asset[];
  errors: FieldErrors<ScheduleFormValues>;
  register: UseFormRegister<ScheduleFormValues>;
  watch: UseFormWatch<ScheduleFormValues>;
  control: Control<ScheduleFormValues>;
  reset: UseFormReset<ScheduleFormValues>;
  handleSubmit: UseFormHandleSubmit<ScheduleFormValues>;
  setValue: UseFormSetValue<ScheduleFormValues>;
  onSubmit: (data: ScheduleFormValues) => Promise<void>;

  isLoading: boolean;
};

const ScheduleFormContext = createContext<ScheduleFormContextProps | null>(null);

export function ScheduleFormProvider({ children, schedule }: { children: React.ReactNode; schedule?: Schedule | null }) {
  const { close } = useViewModal();
  const { assets = [] } = useAssets();
  const { schedules = [] } = useSchedules();
  const editMode = !!schedule;
  const { updateScheduleApi, isUpdating } = useSchedule();
  const initialDate = schedule?.nexRunTime ? new Date(schedule.nexRunTime) : null;

  const {
    formState: { errors },
    handleSubmit,
    register,
    watch,
    control,
    reset,
    setValue,
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(ScheduleFormSchema),
    defaultValues: {
      asset: schedule?.asset || null,
      scanType: schedule?.scanType || "quick",
      mode: schedule?.frequency?.mode || "none",
      repeatEvery: schedule?.frequency?.repeatEvery || null,
      repeatUnit: schedule?.frequency?.repeatUnit || null,
      startDate: initialDate,
      startTime: initialDate ? format(initialDate, "HH:mm") : null,
    },
  });

  const [isAdding, setIsAdding] = useState(false);
  const isLoading = isUpdating || isAdding;

  async function onSubmit(data: ScheduleFormValues): Promise<void> {
    if (!data.asset?.id) return;

    const startDateTime =
      data.startDate && data.startTime ? combineDateAndTime(new Date(data.startDate), data.startTime).toISOString() : null;

    if (editMode) {
      if (!schedule?.id) return;

      const isDuplicate = schedules.some((s) => s.asset.id === data.asset.id && s.id !== schedule.id);
      if (isDuplicate) {
        toast.error(`Asset ${data.asset.value} already has a schedule`);
        return;
      }

      const editPayload = {
        asset: data.asset,
        scanType: data.scanType,
        frequency:
          data.mode === "none"
            ? null
            : {
                mode: data.mode,
                repeatEvery: data.repeatEvery,
                repeatUnit: data.repeatUnit,
              },
        ...(startDateTime && { nexRunTime: startDateTime }),
      };

      await updateScheduleApi({ id: schedule.id, updatedSchedule: editPayload as any });
    }

    if (!editMode) {
      setIsAdding(true);
      const isDuplicate = schedules.some((s) => s.asset.id === data.asset.id);
      if (isDuplicate) {
        toast.error(`Asset ${data.asset.value} already has a schedule`);
        return;
      }
      const addPayload = {
        asset: data.asset,
        scanType: data.scanType,
        frequency:
          data.mode === "none"
            ? null
            : {
                mode: data.mode,
                repeatEvery: data.repeatEvery,
                repeatUnit: data.repeatUnit,
              },
        firstStartTime: startDateTime,
        nexRunTime: startDateTime,
        status: "active",
      };

      console.log("Adding new schedule payload:", addPayload);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsAdding(false);
    }

    close();
  }

  return (
    <ScheduleFormContext.Provider
      value={{
        close,
        assets,
        errors,
        handleSubmit,
        register,
        watch,
        control,
        reset,
        setValue,
        onSubmit,
        editMode,
        isLoading,
      }}
    >
      {children}
    </ScheduleFormContext.Provider>
  );
}

export function useScheduleFormContext() {
  const context = useContext(ScheduleFormContext);
  if (!context) throw new Error("useScheduleFormContext must be used within Provider");
  return context;
}
