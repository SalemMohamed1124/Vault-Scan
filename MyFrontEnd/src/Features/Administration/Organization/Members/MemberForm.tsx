import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Member } from "@/Types/data-types";
import { MemberFormProvider, useMemberForm } from "./MemberFormContext";

export function MemberForm({ member }: { member?: Member | null }) {
  return (
    <MemberFormProvider member={member}>
      <MemberFormWrapper />
    </MemberFormProvider>
  );
}

function MemberFormWrapper() {
  const { handleSubmit, onSubmit } = useMemberForm();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] min-h-0">
      <ScrollArea className="min-h-0 py-3">
        <div className="flex flex-col gap-3 px-3">
          <FieldGroup>
            <MemberNameField />
            <MemberEmailField />
            <MemberRoleField />
          </FieldGroup>
        </div>
      </ScrollArea>
      <MemberFormFooter />
    </form>
  );
}

function MemberNameField() {
  const { register, errors, editMode } = useMemberForm();
  return (
    <Field>
      <FieldLabel>Name</FieldLabel>
      <Input placeholder="John Doe" {...register("name")} disabled={editMode} />
      <FieldError errors={[{ message: errors.name?.message }]} />
    </Field>
  );
}

function MemberEmailField() {
  const { register, errors, editMode } = useMemberForm();
  return (
    <Field>
      <FieldLabel>Email</FieldLabel>
      <Input placeholder="john@example.com" {...register("email")} disabled={editMode} />
      <FieldError errors={[{ message: errors.email?.message }]} />
    </Field>
  );
}

function MemberRoleField() {
  const { control, errors } = useMemberForm();
  return (
    <Field>
      <FieldLabel>Role</FieldLabel>
      <Controller
        name="role"
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <FieldError errors={[{ message: errors.role?.message }]} />
    </Field>
  );
}

function MemberFormFooter() {
  const { close, reset, isLoading, editMode } = useMemberForm();
  return (
    <div className="flex justify-end gap-2 p-3 border-t">
      <Button variant="outline" type="button" onClick={close} disabled={isLoading}>
        Cancel
      </Button>
      <Button variant="outline" type="button" onClick={() => reset()} disabled={isLoading}>
        Reset
      </Button>
      <Button type="submit" disabled={isLoading} variant="primary">
        {isLoading ? <Spinner /> : editMode ? "Update" : "Invite"}
      </Button>
    </div>
  );
}
