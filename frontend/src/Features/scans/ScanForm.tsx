"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Controller } from "react-hook-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Shield, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScanFormProvider, useScanForm } from "./ScanFormContext";
import { ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import type { ScanType, AuthMode } from "@/types";

export default function ScanForm() {
  return (
    <ScanFormProvider onClose={() => {}}>
      <ScanFormWrapper />
    </ScanFormProvider>
  );
}

function ScanFormWrapper() {
  const { handleSubmit, onSubmit, isLoading, reset, close, watch, setValue, control, assets, formState: { errors } } = useScanForm();
  
  const authMode = watch("authMode");
  const scanType = watch("type");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] min-h-0 max-h-[82vh] sm:max-h-[75vh]">
      <ScrollArea className="min-h-0 py-6">
        <div className="flex flex-col gap-6 px-6 pb-6">
          <AssetSelectionField />

          <ScanTypeSelector />

          <AuthSection />
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
          {isLoading ? <Loader2 className="animate-spin" /> : <Play />}
          Start Scan
        </Button>
      </div>
    </form>
  );
}

function AssetSelectionField() {
  const { control, assets, formState: { errors } } = useScanForm();

  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">
        Target Asset
      </FieldLabel>
      <Controller
        name="assetId"
        control={control}
        render={({ field }) => (
          <Combobox
            items={assets}
            filter={(asset, query) => {
              const searchTerm = query.toLowerCase();
              return asset.name.toLowerCase().includes(searchTerm) || asset.value.toLowerCase().includes(searchTerm);
            }}
            itemToStringValue={(asset) => asset?.name ?? ""}
            onValueChange={(selectedAsset) => {
              field.onChange(selectedAsset?.id || "");
            }}
            value={assets.find((a) => a.id === field.value) || null}
          >
              <ComboboxInput 
                placeholder="Select Asset..." 
                className="h-10 bg-muted/5 border-border rounded-md transition-all"
              />
            <ComboboxContent className="bg-popover border-border rounded-lg overflow-hidden shadow-lg z-100">
              <ComboboxEmpty className="p-4 text-center text-muted-foreground text-xs">No assets found</ComboboxEmpty>
              <ComboboxList className="max-h-64 custom-scrollbar p-1">
                {(asset) => (
                  <ComboboxItem key={asset.id} value={asset} className="px-3 py-2 data-highlighted:bg-muted data-highlighted:text-foreground transition-colors border-b border-border/5 last:border-0 rounded-md">
                    <ItemContent>
                      <div className="flex items-center gap-2.5">
                        <div className="flex flex-col">
                           <ItemTitle className="text-xs font-medium text-foreground">{asset.name}</ItemTitle>
                           <ItemDescription className="text-[10px] text-muted-foreground font-mono">{asset.value}</ItemDescription>
                        </div>
                      </div>
                    </ItemContent>
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

function ScanTypeSelector() {
  const { setValue, watch } = useScanForm();
  const scanType = watch("type");

  return (
    <Field>
      <FieldLabel className="text-xs font-semibold text-foreground mb-1.5 ml-0.5">Scan Type</FieldLabel>
      <div className="flex gap-1.5 p-1 rounded-md bg-muted/10 border border-border/50">
        {[
          { id: "QUICK", label: "Quick Scan", icon: Zap },
          { id: "DEEP", label: "Deep Scan", icon: Shield },
        ].map((mode) => (
          <button 
            key={mode.id}
            type="button"
            onClick={() => setValue("type", mode.id as ScanType)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 rounded text-xs font-medium transition-all",
              scanType === mode.id ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
            )}
          >
            <mode.icon className="size-3.5" />
            {mode.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function AuthSection() {
  const { watch, setValue, control } = useScanForm();
  const authMode = watch("authMode");

  return (
    <div className="p-4 rounded-lg bg-muted/5 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <h4 className="font-semibold text-xs text-foreground ml-0.5">Authentication & Headers</h4>
      </div>
      
      <div className="flex flex-wrap sm:grid sm:grid-cols-4 gap-1 p-1 rounded-md bg-muted/20 mb-4 border border-border/50">
          {['auto', 'credentials', 'cookies', 'none'].map((mode) => (
            <button
            key={mode}
            type="button"
            onClick={() => setValue("authMode", mode as AuthMode)}
            className={cn(
              "flex-1 py-1.5 rounded text-[10px] font-medium capitalize transition-all",
              authMode === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            >
              {mode}
            </button>
          ))}
      </div>

      {authMode === 'credentials' && (
        <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Input placeholder="Username / ID" {...control.register("username")} className="h-9 text-xs bg-background border-border rounded-md" />
            <Input type="password" placeholder="Password / Key" {...control.register("password")} className="h-9 text-xs bg-background border-border rounded-md" />
            <Input placeholder="Login URL" {...control.register("loginUrl")} className="h-9 text-xs bg-background border-border rounded-md font-mono" />
        </div>
      )}

      {authMode === 'cookies' && (
        <div className="space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Input placeholder="Cookies (name=value; ...)" {...control.register("cookies")} className="h-9 text-[10px] bg-background border-border rounded-md font-mono" />
            <Input placeholder="Custom Headers (JSON or Key:Value)" {...control.register("customHeaders")} className="h-9 text-[10px] bg-background border-border rounded-md font-mono" />
        </div>
      )}
    </div>
  );
}
