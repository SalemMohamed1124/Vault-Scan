import { createContext, useContext, ReactNode, useMemo } from "react";
import { useForm, UseFormReturn, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanFormSchema, type ScanFormValues } from "./ScanFormSchema";
import { useAssets } from "@/Features/assets/useAssets";
import { useViewModal } from "@/Contexts/ViewModalContext";
import useScan from "./useScan";
import type { Asset, StartScanPayload } from "@/types";

interface ScanFormContextProps extends UseFormReturn<ScanFormValues> {
  onSubmit: (values: ScanFormValues) => void;
  isLoading: boolean;
  close: () => void;
  assets: Asset[];
}

const ScanFormContext = createContext<ScanFormContextProps | null>(null);

export function ScanFormProvider({ 
  onClose,
  children 
}: { 
  onClose?: () => void;
  children: ReactNode;
}) {
  const { close: modalClose } = useViewModal();
  const { startScanApi, isStarting } = useScan();
  const { assets: assetsData } = useAssets();
  
  const assets = useMemo(() => assetsData?.data || [], [assetsData]);

  const form = useForm<ScanFormValues>({
    resolver: zodResolver(ScanFormSchema),
    defaultValues: {
      type: "QUICK",
      authMode: "auto",
      username: "",
      password: "",
      loginUrl: "",
      cookies: "",
      customHeaders: "",
    },
  });

  const onSubmit = async (values: ScanFormValues) => {
    const payload: StartScanPayload = {
      assetId: values.assetId,
      type: values.type,
    };

    if (values.authMode === "credentials" && values.username && values.password) {
      const credHeader = `X-VaultScan-Username:${values.username};;X-VaultScan-Password:${values.password}`;
      payload.customHeaders = values.loginUrl ? `${credHeader};;X-VaultScan-LoginURL:${values.loginUrl}` : credHeader;
    }

    if (values.authMode === "cookies" && values.cookies?.trim()) {
      payload.cookies = values.cookies.trim();
    }
    if (values.customHeaders?.trim() && values.authMode === "cookies") {
      payload.customHeaders = values.customHeaders.trim();
    }

    try {
      await startScanApi(payload);
      modalClose();
      onClose?.();
    } catch (error) {
      // Error handled by hook
    }
  };

  const value = {
    ...form,
    onSubmit,
    isLoading: isStarting,
    close: () => {
      modalClose();
      onClose?.();
    },
    assets,
  };

  return (
    <ScanFormContext.Provider value={value}>
      <FormProvider {...form}>
        {children}
      </FormProvider>
    </ScanFormContext.Provider>
  );
}

export function useScanForm() {
  const context = useContext(ScanFormContext);
  if (!context) {
    throw new Error("useScanForm must be used within a ScanFormProvider");
  }
  return context;
}
