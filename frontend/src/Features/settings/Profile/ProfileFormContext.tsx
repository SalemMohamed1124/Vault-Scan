"use client";

import { createContext, useContext, ReactNode } from "react";
import { useForm, UseFormReturn, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  ProfileFormSchema, type ProfileFormValues,
  PasswordFormSchema, type PasswordFormValues 
} from "./ProfileFormSchema";
import { useUpdateProfile, useChangePassword } from "../useSettingMutations";
import { useAuth } from "@/hooks/useAuth";

// --- Profile Identity Context ---
interface ProfileFormContextProps extends UseFormReturn<ProfileFormValues> {
  onSubmit: (values: ProfileFormValues) => Promise<void>;
  isLoading: boolean;
}

const ProfileFormContext = createContext<ProfileFormContextProps | null>(null);

export function ProfileFormProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { mutateAsync: updateProfileApi, isPending: isUpdatingProfile } = useUpdateProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: { name: user?.name || "" },
  });

  async function onSubmit(values: ProfileFormValues) {
    if (!user) return;
    await updateProfileApi({ name: values.name, user });
  }

  const value = { ...form, onSubmit, isLoading: isUpdatingProfile };

  return (
    <ProfileFormContext.Provider value={value}>
      <FormProvider {...form}>{children}</FormProvider>
    </ProfileFormContext.Provider>
  );
}

export function useProfileForm() {
  const context = useContext(ProfileFormContext);
  if (!context) throw new Error("useProfileForm must be used within a ProfileFormProvider");
  return context;
}

// --- Password Context ---
interface PasswordFormContextProps extends UseFormReturn<PasswordFormValues> {
  onSubmit: (values: PasswordFormValues) => Promise<void>;
  isLoading: boolean;
}

const PasswordFormContext = createContext<PasswordFormContextProps | null>(null);

export function PasswordFormProvider({ children }: { children: ReactNode }) {
  const { mutateAsync: changePasswordApi, isPending: isChangingPassword } = useChangePassword();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: PasswordFormValues) {
    await changePasswordApi({ 
      currentPassword: values.currentPassword, 
      newPassword: values.newPassword 
    });
    form.reset();
  }

  const value = { ...form, onSubmit, isLoading: isChangingPassword };

  return (
    <PasswordFormContext.Provider value={value}>
      <FormProvider {...form}>{children}</FormProvider>
    </PasswordFormContext.Provider>
  );
}

export function usePasswordForm() {
  const context = useContext(PasswordFormContext);
  if (!context) throw new Error("usePasswordForm must be used within a PasswordFormProvider");
  return context;
}
