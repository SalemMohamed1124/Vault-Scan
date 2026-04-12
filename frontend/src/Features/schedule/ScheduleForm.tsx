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
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] min-h-0 max-h-[82vh] sm:max-h-[75vh]">
      <ScrollArea className="min-h-0 py-6">
        <div className="flex flex-col gap-6 px-6 pb-6">
          <FieldGroup className="gap-6">
            <AssetSelectionField />
            <ScanTypeField />
            <FrequencyField />
            <ScheduledTimeField />
          </FieldGroup>
        </div>
      </ScrollArea>

      <div className="flex flex-col sm:flex-row justify-end gap-2 px-6 py-4 border-t border-border bg-background">
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
          className="w-full sm:w-auto h-9 px-6 text-xs font-semibold gap-2"
        >
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
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Scan Type</FieldLabel>
      <Controller
        name="scanType"
        control={control}
        render={({ field }) => (
          <div className="flex gap-1.5 p-1 rounded-md bg-muted/10 border border-border/50">
            {[
              { id: "QUICK", label: "Quick Scan", icon: Zap },
              { id: "DEEP", label: "Deep Scan", icon: Shield },
            ].map((mode) => (
              <button 
                key={mode.id}
                type="button"
                onClick={() => field.onChange(mode.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-medium transition-all",
                  field.value === mode.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
                )}
              >
                <mode.icon className="size-3.5" />
                {mode.label}
              </button>
            ))}
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
