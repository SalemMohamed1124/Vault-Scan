import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Controller } from "react-hook-form";
import { ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScheduleFormProvider } from "./ScheduleFormContext";
import { useScheduleFormContext } from "./ScheduleFormContext";
import { Spinner } from "@/components/ui/spinner";
import type { Schedule } from "@/Types/data-types";

export default function ScheduleForm({ schedule }: { schedule?: Schedule | null }) {
  return (
    <ScheduleFormProvider schedule={schedule ?? null}>
      <ScheduleFormWrapper />
    </ScheduleFormProvider>
  );
}

function ScheduleFormWrapper() {
  const { handleSubmit, onSubmit } = useScheduleFormContext();
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] min-h-0">
      <ScrollArea className="min-h-0 py-3">
        <div className="flex flex-col gap-3 px-3">
          <AssetSelectionField />
          <ScanTypeField />
          <FrequencyField />
          <RepeatField />
          <StartDate />
        </div>
      </ScrollArea>
      <ScheduleFormFooter />
    </form>
  );
}

export function AssetSelectionField() {
  const { control, assets, errors } = useScheduleFormContext();

  return (
    <Field>
      <FieldLabel>Asset</FieldLabel>
      <Controller
        name="asset"
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
              field.onChange(selectedAsset || null);
            }}
            value={assets.find((a) => a.id === field.value?.id) || null}
          >
            <ComboboxInput placeholder="Search by name or IP..." showClear={true} />
            <ComboboxContent>
              <ComboboxEmpty>No assets found.</ComboboxEmpty>
              <ComboboxList>
                {(asset) => (
                  <ComboboxItem key={asset.id} value={asset}>
                    <ItemContent>
                      <ItemHeader>
                        <ItemTitle className="whitespace-nowrap">{asset.name}</ItemTitle>
                      </ItemHeader>
                      <ItemDescription>
                        {asset.type} | {asset.value}
                      </ItemDescription>
                    </ItemContent>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        )}
      />
      <FieldError errors={[errors.asset]} />
    </Field>
  );
}

function ScanTypeField() {
  const { control, errors } = useScheduleFormContext();
  return (
    <Field>
      <FieldLabel>Scan Type</FieldLabel>
      <Controller
        name="scanType"
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value || ""}>
            <SelectTrigger>
              <SelectValue placeholder="Select scan type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick">Quick Scan</SelectItem>
              <SelectItem value="full">Full Scan</SelectItem>
              <SelectItem value="port">Port Scan</SelectItem>
              <SelectItem value="vulnerability">Vulnerability Scan</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError errors={[errors.scanType]} />
    </Field>
  );
}

function FrequencyField() {
  const { control, setValue, errors } = useScheduleFormContext();
  const modeOptions = ["once", "repeat", "none"];

  return (
    <Field>
      <FieldLabel>Mode</FieldLabel>
      <Controller
        name="mode"
        control={control}
        render={({ field }) => (
          <Select
            onValueChange={(val) => {
              field.onChange(val);
              if (val === "repeat") {
                setValue("repeatEvery", 1);
                setValue("repeatUnit", "day");
              } else {
                setValue("repeatEvery", null);
                setValue("repeatUnit", null);
                if (val === "none") {
                  setValue("startDate", null);
                  setValue("startTime", null);
                }
              }
            }}
            value={field.value || ""}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frequency" />
            </SelectTrigger>
            <SelectContent>
              {modeOptions.map((option) => (
                <SelectItem key={option} value={option} className="capitalize">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <FieldError errors={[errors.mode]} />
    </Field>
  );
}

function RepeatField() {
  const { control, register, watch, errors } = useScheduleFormContext();
  const repeatEvery = watch("repeatEvery");
  const repeatUnit = watch("repeatUnit");
  const mode = watch("mode");
  const isRepeat = mode === "repeat";
  const units = ["day", "week", "month"];

  return (
    <>
      {isRepeat && (
        <FieldGroup className="grid grid-cols-2 gap-2 items-end">
          <Field>
            <FieldLabel>Repeat Every</FieldLabel>
            <Input id="repeatEvery" type="number" min={1} step={1} {...register("repeatEvery", { valueAsNumber: true })} />
            <FieldError errors={[errors.repeatEvery]} />
          </Field>
          <Field>
            <Controller
              name="repeatUnit"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit} value={unit} className="capitalize">
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.repeatUnit]} />
          </Field>
          <p className="text-sm text-muted-foreground font-mono col-span-2 capitalize">
            Scan runs every {repeatEvery || 1} {repeatUnit || "day"}(s)
          </p>
        </FieldGroup>
      )}
    </>
  );
}

function StartDate() {
  const { control, errors, watch } = useScheduleFormContext();
  const mode = watch("mode");
  return (
    <>
      {mode && mode !== "none" && (
        <Field>
          <FieldLabel>Start Date</FieldLabel>
          <DateTimePicker control={control} />
          <FieldError errors={[errors.startDate, errors.startTime]} />
        </Field>
      )}
    </>
  );
}

function ScheduleFormFooter() {
  const { close, reset, editMode, isLoading } = useScheduleFormContext();
  return (
    <div className="flex justify-end gap-2 p-3 border-t">
      <Button variant="outline" type="button" onClick={close}>
        Cancel
      </Button>
      <Button variant="outline" type="button" onClick={() => reset()}>
        Reset
      </Button>
      <Button type="submit" variant="primary">
        {isLoading ? <Spinner /> : editMode ? "Update" : "Save Schedule"}
      </Button>
    </div>
  );
}
