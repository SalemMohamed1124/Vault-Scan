"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterFormData } from "./RegisterSchema";
import { AxiosError } from "axios";
import { useRegisterMutation } from "./useRegister";

type PasswordStrength = "weak" | "medium" | "strong";

function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (hasUpper && hasNumber) return "strong";
  return "medium";
}

interface RegisterContextType extends UseFormReturn<RegisterFormData> {
  onSubmit: (data: RegisterFormData) => void;
  isLoading: boolean;
  globalError: string | null;
  passwordStrength: PasswordStrength;
}

const RegisterContext = createContext<RegisterContextType | undefined>(undefined);

export function RegisterProvider({ children }: { children: ReactNode }) {

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const password = form.watch("password");
  const passwordStrength = useMemo(() => getPasswordStrength(password || ""), [password]);

  const registerMutation = useRegisterMutation();

  const globalError = useMemo(() => {
    if (!registerMutation.error) return null;
    const err = registerMutation.error;
    if (err instanceof AxiosError) {
      if (err.response?.status === 409) return "An account with this email already exists";
      if (err.response?.data?.message) {
        const msg = err.response.data.message;
        return Array.isArray(msg) ? msg[0] : (msg as string);
      }
      return "Connection failed. Please try again.";
    }
    return "An unexpected error occurred";
  }, [registerMutation.error]);

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  return (
    <RegisterContext.Provider value={{ ...form, onSubmit, isLoading: registerMutation.isPending, globalError, passwordStrength }}>
      {children}
    </RegisterContext.Provider>
  );
}

export function useRegister() {
  const context = useContext(RegisterContext);
  if (!context) {
    throw new Error("useRegister must be used within a RegisterProvider");
  }
  return context;
}
