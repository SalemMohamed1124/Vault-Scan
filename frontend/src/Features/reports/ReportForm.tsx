"use client";

import { FileText, FileJson, Globe, CheckCircle2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ReportFormProvider, useReportForm } from "./ReportFormContext";
import { Controller } from "react-hook-form";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";

export default function ReportForm({ onSuccess }: { onSuccess?: () => void }) {
  return (
    <ReportFormProvider onSuccess={onSuccess}><ReportFormWrapper /></ReportFormProvider>
  );
}

function ReportFormWrapper() {
  const { handleSubmit, onSubmit, isLoading, reset, close } = useReportForm();
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[min(82vh,600px)]">
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-5">
          <FieldGroup className="gap-6">
            <ScanSelectionField />
            <FormatSelectionField />
          </FieldGroup>
        </div>
      </ScrollArea>
      <FormFooter isLoading={isLoading} reset={reset} close={close} />
    </form>
  );
}

function ScanSelectionField() {
  const { control, scans, formState: { errors } } = useReportForm();
  const items = scans.map(s => ({ ...s, label: s.asset?.name || "Unnamed Operation" }));
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold">Evidence Source</FieldLabel>
      <Controller name="scanId" control={control} render={({ field }) => (
        <Combobox
          items={items}
          itemToStringLabel={s => s.label}
          itemToStringValue={s => s.label}
          onValueChange={s => field.onChange(s?.id || "")}
          value={items.find(s => s.id === field.value) || null}
        >
          <ComboboxInput placeholder="Select source..." className="h-10 bg-muted/5 text-xs" />
          <ComboboxContent className="z-100">
            <ComboboxEmpty className="p-4 text-xs">No records found</ComboboxEmpty>
            <ComboboxList className="max-h-64 p-1">
              {s => (
                <ComboboxItem key={s.id} value={s} className="px-3 py-2 border-b border-border/5 last:border-0 rounded-md flex-col items-start gap-0.5">
                  <span className="text-xs font-medium text-foreground">{s.label}</span>
                  <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                    {s.id.slice(0, 8)} <span className="size-1 rounded-full bg-border" /> {formatRelativeTime(s.completedAt!)}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{s.findingsCount || 0} findings</span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )} />
      <FieldError errors={[errors.scanId]} />
    </Field>
  );
}

function FormatSelectionField() {
  const { control, formState: { errors } } = useReportForm();
  const options = [
    { v: "PDF", l: "Executive PDF", d: "Professional PDF document", i: FileText },
    { v: "JSON", l: "Tactical JSON", d: "Raw security metadata", i: FileJson },
    { v: "HTML", l: "Interactive HTML", d: "Web-based analysis portal", i: Globe }
  ];
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold">Output Format</FieldLabel>
      <Controller name="format" control={control} render={({ field }) => (
        <div className="grid gap-2">
          {options.map(opt => (
            <button key={opt.v} type="button" onClick={() => field.onChange(opt.v)} className={cn("flex items-center gap-3 p-2 rounded-md border text-left group", field.value === opt.v ? "border-primary bg-primary/10" : "border-border bg-muted/5 hover:border-primary/20")}>
              <div className={cn("size-8 rounded flex items-center justify-center border", field.value === opt.v ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-transparent opacity-50")}>
                <opt.i className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className={cn("text-[11px] font-semibold", field.value === opt.v && "text-primary")}>{opt.l}</span>
                <p className="text-[9px] text-muted-foreground font-medium leading-tight">{opt.d}</p>
              </div>
              {field.value === opt.v && <CheckCircle2 className="ml-auto size-3 text-primary" />}
            </button>
          ))}
        </div>
      )} />
      <FieldError errors={[errors.format]} />
    </Field>
  );
}

function FormFooter({ isLoading, reset, close }: { isLoading: boolean, reset: () => void, close: () => void }) {
  return (
    <div className="flex justify-end gap-3 px-5 py-4 border-t bg-background/50 backdrop-blur-sm">
      <div className="flex gap-2 w-full sm:w-auto">
        <Button variant="outline" type="button" onClick={close} disabled={isLoading} className="flex-1 sm:w-20 h-9 text-xs font-semibold">Cancel</Button>
        <Button variant="outline" type="button" onClick={reset} disabled={isLoading} className="flex-1 sm:w-20 h-9 text-xs font-semibold">Reset</Button>
      </div>
      <Button type="submit" disabled={isLoading} variant="primary" className="w-full sm:w-auto h-9 px-6 text-xs font-semibold gap-2">
        {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Generate Report
      </Button>
    </div>
  );
}
