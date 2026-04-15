"use client";

import { createContext, useContext, ReactNode } from "react";
import { useForm, UseFormReturn, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScheduleFormSchema, type ScheduleFormValues } from "./ScheduleFormSchema";
import { useAssetsForSchedules } from "./useSchedules";
import { useCreateSchedule, useUpdateSchedule } from "./useScheduleMutations";
import { useViewModal } from "@/Contexts/ViewModalContext";
import type { ScanSchedule, Asset } from "@/types";

interface ScheduleFormContextProps extends UseFormReturn<ScheduleFormValues> {
  onSubmit: (values: ScheduleFormValues) => void;
  isLoading: boolean;
  editMode: boolean;
  assets: Asset[];
  close: () => void;
}

const ScheduleFormContext = createContext<ScheduleFormContextProps | null>(null);

export function ScheduleFormProvider({ 
  schedule, 
  onSuccess,
  children 
}: { 
  schedule: ScanSchedule | null; 
  onSuccess?: () => void;
  children: ReactNode;
}) {
  const { close } = useViewModal();
  const { assets = [] } = useAssetsForSchedules();
  const { mutateAsync: addScheduleApi, isPending: isAdding } = useCreateSchedule();
  const { mutateAsync: updateScheduleApi, isPending: isUpdating } = useUpdateSchedule(schedule?.id);
  const editMode = !!schedule;

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(ScheduleFormSchema),
    defaultValues: {
      assetId: schedule?.assetId || "",
      frequency: schedule?.frequency || "WEEKLY",
      scanType: schedule?.scanType || "QUICK",
      scheduledTime: schedule?.nextRunAt ? new Date(schedule.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "02:00",
      isActive: schedule?.isActive ?? true,
    },
  });

  const onSubmit = async (values: ScheduleFormValues) => {
    try {
      const [hours, minutes] = values.scheduledTime.split(':').map(Number);
      const nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);
      
      // If time is already past today, schedule for tomorrow
      if (nextRun < new Date()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      const payload = {
        assetId: values.assetId,
        scanType: values.scanType,
        frequency: values.frequency,
        nextRunAt: nextRun.toISOString(),
      };

      if (editMode && schedule) {
        await updateScheduleApi({ id: schedule.id, data: { ...payload, isActive: values.isActive } as any });
      } else {
        await addScheduleApi(payload);
      }
      onSuccess?.();
      close();
    } catch (error) {
    }
  };

  const value: ScheduleFormContextProps = {
    ...form,
    onSubmit,
    isLoading: isAdding || isUpdating,
    editMode,
    assets,
    close,
  };

  return (
    <ScheduleFormContext.Provider value={value}>
      <FormProvider {...form}>
        {children}
      </FormProvider>
    </ScheduleFormContext.Provider>
  );
}

export function useScheduleForm() {
  const context = useContext(ScheduleFormContext);
  if (!context) {
    throw new Error("useScheduleForm must be used within a ScheduleFormProvider");
  }
  return context;
}
