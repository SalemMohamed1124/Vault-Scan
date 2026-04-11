import { useViewModal } from "@/Contexts/ViewModalContext";
import type { Asset } from "@/Types/data-types";
import { createContext, useContext } from "react";
import useAsset from "./useAsset";
import {
  useForm,
  type Control,
  type FieldErrors,
  type UseFormHandleSubmit,
  type UseFormRegister,
  type UseFormReset,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssetFormSchema, type AssetFormValues } from "./AssetFormSchema";

type AssetFormContextProps = {
  isLoading: boolean;
  editMode: boolean;
  onSubmit: (data: AssetFormValues) => Promise<void>;
  handleSubmit: UseFormHandleSubmit<AssetFormValues>;
  register: UseFormRegister<AssetFormValues>;
  control: Control<AssetFormValues>;
  reset: UseFormReset<AssetFormValues>;
  errors: FieldErrors<AssetFormValues>;
  close: () => void;
};

const AssetFormContext = createContext<AssetFormContextProps | null>(null);

export function AssetFormProvider({ children, asset }: { children: React.ReactNode; asset: Asset | null }) {
  const { close } = useViewModal();
  const { addAssetApi, updateAssetApi, isAdding, isUpdating } = useAsset(asset?.id);
  const editMode = !!asset;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AssetFormValues>({
    resolver: zodResolver(AssetFormSchema),
    defaultValues: {
      name: asset?.name || "",
      type: asset?.type || "domain",
      value: asset?.value || "",
      tags: asset?.tags?.join(", ") || "",
    },
  });

  async function onSubmit(data: AssetFormValues) {
    const tagsArray = data.tags ? data.tags.split(",").map((tag) => tag.trim()) : [];

    if (asset) {
      await updateAssetApi({
        id: asset.id,
        updatedAsset: {
          name: data.name,
          type: data.type,
          value: data.value,
          tags: tagsArray,
        },
      });
    } else {
      await addAssetApi({
        name: data.name,
        type: data.type,
        value: data.value,
        tags: tagsArray,
      });
    }
    close();
  }

  const isLoading = isAdding || isUpdating;
  return (
    <AssetFormContext.Provider value={{ isLoading, onSubmit, handleSubmit, register, control, reset, errors, editMode, close }}>
      {children}
    </AssetFormContext.Provider>
  );
}

export function useAssetForm() {
  const context = useContext(AssetFormContext);
  if (!context) throw new Error("useAssetForm must be used within AssetFormProvider");
  return context;
}
