"use client";

import { 
  useProfileForm, ProfileFormProvider,
  usePasswordForm, PasswordFormProvider 
} from "./ProfileFormContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <ProfileFormProvider>
        <ProfileFormWrapper />
      </ProfileFormProvider>
      
      <PasswordFormProvider>
        <PasswordFormWrapper />
      </PasswordFormProvider>
    </div>
  );
}

function ProfileFormWrapper() {
  const { user } = useAuth();
  const { handleSubmit, onSubmit, isLoading } = useProfileForm();

  return (
    <div className="border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex h-12 w-12 items-center justify-center bg-primary/10 text-primary font-bold text-lg">
          {user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          <h2 className="text-lg font-semibold">{user?.name ?? "User"}</h2>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <ProfileNameField />
          <Field>
            <FieldLabel className="text-xs font-semibold">Email Address</FieldLabel>
            <Input 
              value={user?.email ?? ""} 
              disabled 
              className="h-10 text-sm bg-muted/50" 
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading} className="text-xs">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Update Profile
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProfileNameField() {
  const { formState: { errors }, register } = useProfileForm();
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold">Full Name</FieldLabel>
      <Input {...register("name")} className="h-10 text-sm" />
      <FieldError errors={[errors.name]} />
    </Field>
  );
}

// --- Password Change Section ---
function PasswordFormWrapper() {
  const { handleSubmit, onSubmit, isLoading } = usePasswordForm();

  return (
    <div className="border bg-card p-6 shadow-sm space-y-6">
      <div className="flex items-center gap-2">
        <div className="size-8 bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
          <Lock className="size-4 text-orange-500" />
        </div>
        <h3 className="text-sm font-semibold">Change Password</h3>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <CurrentPasswordField />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NewPasswordField />
          <ConfirmPasswordField />
        </div>
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading} className="text-xs">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Change Password
          </Button>
        </div>
      </form>
    </div>
  );
}

function CurrentPasswordField() {
  const { formState: { errors }, register } = usePasswordForm();
  const [show, setShow] = useState(false);
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold">Current Password</FieldLabel>
      <div className="relative">
        <Input type={show ? "text" : "password"} {...register("currentPassword")} className="pr-10 h-10 text-sm" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError errors={[errors.currentPassword]} />
    </Field>
  );
}

function NewPasswordField() {
  const { formState: { errors }, register } = usePasswordForm();
  const [show, setShow] = useState(false);
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold">New Password</FieldLabel>
      <div className="relative">
        <Input type={show ? "text" : "password"} {...register("newPassword")} className="pr-10 h-10 text-sm" />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError errors={[errors.newPassword]} />
    </Field>
  );
}

function ConfirmPasswordField() {
  const { formState: { errors }, register } = usePasswordForm();
  const [show, setShow] = useState(false);
  return (
    <Field>
      <FieldLabel className="text-xs font-semibold">Confirm New Password</FieldLabel>
      <div className="relative">
        <Input type={show? "text" : "password"} {...register("confirmPassword")} className={cn("pr-10 h-10 text-sm", errors.confirmPassword && "border-destructive")} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      <FieldError errors={[errors.confirmPassword]} />
    </Field>
  );
}
