"use client";

import { createContext, useContext, ReactNode } from "react";
import { useForm, UseFormReturn, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReportFormSchema, type ReportFormValues } from "./ReportFormSchema";
import { useCompletedScansForReports } from "./useReports";
import useReport from "./useReport";
import { useViewModal } from "@/Contexts/ViewModalContext";
import type { Scan } from "@/types";

interface ReportFormContextProps extends UseFormReturn<ReportFormValues> {
  onSubmit: (values: ReportFormValues) => void;
  isLoading: boolean;
  scans: Scan[];
  scansLoading: boolean;
  close: () => void;
}

const ReportFormContext = createContext<ReportFormContextProps | null>(null);

export function ReportFormProvider({ 
  onSuccess,
  children 
}: { 
  onSuccess?: () => void;
  children: ReactNode;
}) {
  const { close } = useViewModal();
  const { scans = [], isPending: scansLoading } = useCompletedScansForReports();
  const { generateReportApi, isGenerating } = useReport();
  
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(ReportFormSchema),
    defaultValues: {
      scanId: "",
      format: "PDF",
    },
  });

  const onSubmit = async (values: ReportFormValues) => {
    try {
      await generateReportApi(values);
      onSuccess?.();
      close();
    } catch {
      // Error handled in mutation
    }
  };

  const value: ReportFormContextProps = {
    ...form,
    onSubmit,
    isLoading: isGenerating,
    scans,
    scansLoading,
    close,
  };

  return (
    <ReportFormContext.Provider value={value}>
      <FormProvider {...form}>
        {children}
      </FormProvider>
    </ReportFormContext.Provider>
  );
}

export function useReportForm() {
  const context = useContext(ReportFormContext);
  if (!context) {
    throw new Error("useReportForm must be used within a ReportFormProvider");
  }
  return context;
}
