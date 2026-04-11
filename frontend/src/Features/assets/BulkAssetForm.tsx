"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BulkAssetFormSchema, type BulkAssetFormValues } from "./AssetFormSchema";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useViewModal } from "@/Contexts/ViewModalContext";
import { Spinner } from "@/components/ui/spinner";
import type { AssetType } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import useAsset from "./useAsset";

function detectAssetType(value: string): AssetType {

  value = value.trim();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(value)) return "CIDR";
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return "IP";
  if (/^https?:\/\//i.test(value)) return "URL";
  return "DOMAIN";
}

export default function BulkAssetForm() {
  const { close } = useViewModal();
  const { bulkAddAssetsApi, isBulkAdding: isLoading } = useAsset();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<BulkAssetFormValues>({
    resolver: zodResolver(BulkAssetFormSchema),
    defaultValues: {
      targets: "",
    },
  });

  async function onSubmit(values: BulkAssetFormValues) {
    const lines = values.targets.split("\n").map(l => l.trim()).filter(Boolean);
    const items = lines.map(line => ({
      name: line.length > 50 ? line.slice(0, 50) : line,
      type: detectAssetType(line),
      value: line
    }));

    try {
      await bulkAddAssetsApi(items);
      close();
    } catch (error) {
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[min(82vh,600px)]">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 px-5 py-5">
          <FieldGroup>
            <Field>
              <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Asset Targets</FieldLabel>
              <Textarea 
                placeholder={"example.com\n192.168.1.1\nhttps://api.test.com"} 
                className="min-h-[200px] rounded-md resize-none font-mono text-xs bg-muted/5 border-border" 
                {...register("targets")}
              />
              <div className="flex justify-between items-center px-0.5 mt-1.5">
                <p className="text-[10px] text-muted-foreground font-medium opacity-60">
                  Enter one target per line (Domain, IP, or URL)
                </p>
              </div>
              <FieldError errors={[errors.targets]} />
            </Field>
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
          {isLoading ? <Spinner /> : "Import Targets"}
        </Button>
      </div>
    </form>
  );
}
