"use client";

import { createContext, useContext, ReactNode } from "react";
import { useForm, UseFormReturn, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssetFormSchema, type AssetFormValues } from "./AssetFormSchema";
import { useViewModal } from "@/Contexts/ViewModalContext";
import type { Asset } from "@/types";
import useAsset from "./useAsset";
  
interface AssetFormContextProps extends UseFormReturn<AssetFormValues> {
  onSubmit: (values: AssetFormValues) => void;
  isLoading: boolean;
  editMode: boolean;
  close: () => void;
}

const AssetFormContext = createContext<AssetFormContextProps | null>(null);

export function AssetFormProvider({ 
  asset, 
  children 
}: { 
  asset: Asset | null; 
  children: ReactNode;
}) {
  const { close } = useViewModal();
  const editMode = !!asset;

  const form = useForm<AssetFormValues>({
    resolver: zodResolver(AssetFormSchema),
    defaultValues: {
      name: asset?.name || "",
      type: asset?.type || "DOMAIN",
      value: asset?.value || "",
    },
  });

  const { addAssetApi, isAdding, updateAssetApi, isUpdating } = useAsset();

  const isLoading = isAdding || isUpdating;

  async function onSubmit(values: AssetFormValues) {

      if (editMode && asset) {
        await updateAssetApi({ id: asset.id, updatedAsset: values });
      } else {
        await addAssetApi(values as any);
      }
      close();
  }

  const value = {
    ...form,
    onSubmit,
    isLoading,
    editMode,
    close,
  };

  return (
    <AssetFormContext.Provider value={value}>
      <FormProvider {...form}>
        {children}
      </FormProvider>
    </AssetFormContext.Provider>
  );
}

export function useAssetForm() {
  const context = useContext(AssetFormContext);
  if (!context) {
    throw new Error("useAssetForm must be used within an AssetFormProvider");
  }
  return context;
}
