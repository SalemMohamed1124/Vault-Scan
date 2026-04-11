"use client";

import { Zap, Shield } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { Controller } from "react-hook-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ScanSchedule } from "@/types";
import { ScheduleFormProvider, useScheduleForm } from "./ScheduleFormContext";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

export default function ScheduleForm({ schedule, onSuccess }: { schedule?: ScanSchedule | null; onSuccess?: () => void }) {
  return (
    <ScheduleFormProvider schedule={schedule ?? null} onSuccess={onSuccess}>
      <ScheduleFormWrapper />
    </ScheduleFormProvider>
  );
}

function ScheduleFormWrapper() {
  const { handleSubmit, onSubmit, isLoading, reset, editMode, close } = useScheduleForm();
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[min(82vh,600px)]">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-5 px-5 py-5">
          <FieldGroup className="gap-5">
            <AssetSelectionField />
            <ScanTypeField />
            <FrequencyField />
            <ScheduledTimeField />
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="flex flex-col sm:flex-row justify-end gap-2 px-5 py-4 border-t bg-background/50 backdrop-blur-sm">
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" type="button" onClick={close} disabled={isLoading} className="flex-1 sm:flex-none h-9 px-4 text-xs">Cancel</Button>
          <Button variant="outline" type="button" onClick={() => reset()} disabled={isLoading} className="flex-1 sm:flex-none h-9 px-4 text-xs">Reset</Button>
        </div>
        <Button type="submit" disabled={isLoading} variant="primary" className="w-full sm:w-auto h-9 px-6 text-xs font-semibold gap-2">
          {isLoading ? <Spinner /> : editMode ? "Update Schedule" : "Deploy Schedule"}
        </Button>
      </div>
    </form>
  );
}

function AssetSelectionField() {
  const { assets, control, formState: { errors } } = useScheduleForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Target Asset</FieldLabel>
      <Controller
        name="assetId"
        control={control}
        render={({ field }) => (
          <Combobox
            items={assets}
            itemToStringLabel={a => a.name}
            itemToStringValue={a => a.name}
            onValueChange={a => field.onChange(a?.id || "")}
            value={assets.find(a => a.id === field.value) || null}
          >
            <ComboboxInput placeholder="Select target asset..." className="h-10 text-xs" />
            <ComboboxContent className="z-100">
              <ComboboxEmpty className="p-4 text-xs">No assets found</ComboboxEmpty>
              <ComboboxList className="max-h-56 p-1">
                {a => (
                  <ComboboxItem key={a.id} value={a} className="px-3 py-2 border-b border-border/5 last:border-0 rounded-md flex-col items-start gap-0.5">
                    <span className="text-xs font-medium">{a.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{a.value}</span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      />
      <FieldError errors={[errors.assetId]} />
    </Field>
  );
}

function ScanTypeField() {
  const { control, formState: { errors } } = useScheduleForm();
  return (
    <Field>
      <FieldLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 ml-1">Scan Type</FieldLabel>
      <Controller
        name="scanType"
        control={control}
        render={({ field }) => (
          <div className="flex bg-muted/30 p-1 rounded-xl border border-border/50">
            <button
              type="button"
              onClick={() => field.onChange("QUICK")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 transition-all text-xs font-bold",
                field.value === "QUICK"
                  ? "bg-[#F59E0B] text-black shadow-lg shadow-orange-500/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Zap className={cn("size-3.5", field.value === "QUICK" ? "fill-black" : "")} />
              <span className="uppercase tracking-wide">Quick Scan</span>
            </button>
            <button
              type="button"
              onClick={() => field.onChange("DEEP")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 transition-all text-xs font-bold",
                field.value === "DEEP"
                  ? "bg-[#F59E0B] text-black shadow-lg shadow-orange-500/10"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className={cn("size-3.5", field.value === "DEEP" ? "fill-black" : "")} />
              <span className="uppercase tracking-wide">Deep Scan</span>
            </button>
          </div>
        )}
      />
      <FieldError errors={[errors.scanType]} />
    </Field>
  );
}

function FrequencyField() {
  const { control, formState: { errors } } = useScheduleForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Frequency</FieldLabel>
      <Controller
        name="frequency"
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger className="w-full h-10 text-xs">
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError errors={[errors.frequency]} />
    </Field>
  );
}

function ScheduledTimeField() {
  const { register, formState: { errors } } = useScheduleForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Execution Time</FieldLabel>
      <Input type="time" {...register("scheduledTime")} className="h-10 text-xs" />
      <FieldError errors={[errors.scheduledTime]} />
    </Field>
  );
}
