import * as React from "react";
import { format, startOfDay } from "date-fns";
import { ChevronDownIcon, Clock } from "lucide-react";
import { Controller, type Control } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DateTimePickerProps {
  control: Control<any>;
  value?: Date;
}

export function DateTimePicker({ control, value }: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <FieldGroup className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Date Picker */}
      <Controller
        name="startDate"
        control={control}
        render={({ field }) => (
          <Field>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal text-left">
                  {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                  <ChevronDownIcon className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                < Calendar
                  mode="single"
                  selected={value || field.value || null}
                  onSelect={(date) => {
                    field.onChange(date ?? null);
                    setOpen(false); // Auto-close on select
                  }}
                  disabled={(date) => date < startOfDay(new Date())}
                />
              </PopoverContent>
            </Popover>
          </Field>
        )}
      />

      {/* Time Picker */}
      <Field className="relative">
        <Controller
          name="startTime"
          control={control}
          render={({ field }) => (
            <div className="relative">
              <Input
                id="time-picker-optional"
                type="time"
                step="1"
                placeholder={"Pick a time"}
                {...field}
                onChange={(e) => {
                  field.onChange(e.target.value);
                }}
                value={field.value || ""}
                className="bg-background pr-10 block [appearance:none] [&::-webkit-calendar-picker-indicator]:hidden"
              />
              <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 pointer-events-none" />
            </div>
          )}
        />
      </Field>
    </FieldGroup>
  );
}
