import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { Controller } from "react-hook-form";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Asset } from "@/Types/data-types";
import { AssetFormProvider, useAssetForm } from "./AssetFromContext";

export function AssetForm({ asset }: { asset?: Asset | null }) {
  return (
    <AssetFormProvider asset={asset ?? null}>
      <AssetFormWrapper />
    </AssetFormProvider>
  );
}

function AssetFormWrapper() {
  const { handleSubmit, onSubmit, isLoading, reset, editMode, close } = useAssetForm();
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] min-h-0">
      <ScrollArea className="min-h-0 py-3">
        <div className="flex flex-col gap-3 px-3">
          <FieldGroup>
            <AssetNameField />
            <AssetTypeField />
            <AssetValueField />
            <AssetTagsField />
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="flex justify-end gap-2 p-3 border-t">
        <Button variant="outline" type="button" onClick={close} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant="outline" type="button" onClick={() => reset()} disabled={isLoading}>
          Reset
        </Button>
        <Button type="submit" disabled={isLoading} variant="primary">
          {isLoading ? <Spinner /> : editMode ? "Update Asset" : "Add Asset"}
        </Button>
      </div>
    </form>
  );
}

function AssetNameField() {
  const { errors, register } = useAssetForm();
  return (
    <Field>
      <FieldLabel htmlFor="asset-name">Asset Name</FieldLabel>
      <Input id="asset-name" placeholder="e.g., Main API" {...register("name")} />
      <FieldError errors={[errors.name]} />
    </Field>
  );
}

function AssetTypeField() {
  const { control, errors } = useAssetForm();
  return (
    <Field>
      <FieldLabel htmlFor="asset-type">Type</FieldLabel>
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger id="asset-type">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="domain">Domain</SelectItem>
              <SelectItem value="ip">IP Address</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError errors={[errors.type]} />
    </Field>
  );
}

function AssetValueField() {
  const { register, errors } = useAssetForm();
  return (
    <Field>
      <FieldLabel htmlFor="asset-value">Value</FieldLabel>
      <Input id="asset-value" placeholder="e.g., api.example.com or 192.168.1.10" {...register("value")} />
      <FieldError errors={[errors.value]} />
    </Field>
  );
}

function AssetTagsField() {
  const { register, errors } = useAssetForm();
  return (
    <Field>
      <FieldLabel htmlFor="asset-tags">Tags (comma-separated)</FieldLabel>
      <Input id="asset-tags" placeholder="e.g., Production, Critical" {...register("tags")} />
      <FieldError errors={[{ message: errors.tags?.message }]} />
    </Field>
  );
}
