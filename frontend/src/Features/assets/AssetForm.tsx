"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { Controller } from "react-hook-form";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Asset } from "@/types";
import { AssetFormProvider, useAssetForm } from "./AssetFormContext";

export default function AssetForm({ asset }: { asset?: Asset | null }) {
  return (
    <AssetFormProvider asset={asset ?? null} >
      <AssetFormWrapper />
    </AssetFormProvider>
  );
}

function AssetFormWrapper() {
  const { handleSubmit, onSubmit, isLoading, reset, editMode, close } = useAssetForm();
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[min(82vh,600px)]">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-5 px-5 py-5">
          <FieldGroup className="gap-5">
            <AssetNameField />
            <AssetTypeField />
            <AssetValueField />
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="flex flex-col sm:flex-row justify-end gap-2 px-5 py-4 border-t bg-background/50 backdrop-blur-sm">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" type="button" onClick={close} disabled={isLoading} className="flex-1 sm:flex-none h-9 px-4 text-xs">
            Cancel
          </Button>
          <Button variant="outline" type="button" onClick={() => reset()} disabled={isLoading} className="flex-1 sm:flex-none h-9 px-4 text-xs">
            Reset
          </Button>
        </div>
        <Button 
          type="submit" 
          disabled={isLoading} 
          variant="primary"
          className="w-full sm:w-auto h-9 px-6 text-xs font-semibold"
        >
          {isLoading ? <Spinner /> : editMode ? "Update Asset" : "Add Asset"}
        </Button>
      </div>
    </form>
  );
}

function AssetNameField() {
  const { formState: { errors }, register } = useAssetForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Asset Name</FieldLabel>
      <Input placeholder="e.g., Main API" {...register("name")} className="h-10 text-xs" />
      <FieldError errors={[errors.name]} />
    </Field>
  );
}

function AssetTypeField() {
  const { control, formState: { errors }, editMode } = useAssetForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Asset Type</FieldLabel>
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value} disabled={editMode}>
            <SelectTrigger className="w-full h-10 text-xs">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DOMAIN">Domain</SelectItem>
              <SelectItem value="IP">IP Address</SelectItem>
              <SelectItem value="URL">URL</SelectItem>
              <SelectItem value="CIDR">CIDR Range</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError errors={[errors.type]} />
    </Field>
  );
}

function AssetValueField() {
  const { register, formState: { errors } } = useAssetForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Value (Domain/IP/CIDR)</FieldLabel>
      <Input placeholder="e.g., api.example.com or 192.168.1.10" {...register("value")} className="h-10 text-xs" />
      <FieldError errors={[errors.value]} />
    </Field>
  );
}

