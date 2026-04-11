"use client";

import { createContext, useContext, ReactNode, useMemo } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginFormData } from "./LoginSchema";
import { AxiosError } from "axios";
import { useLoginMutation } from "./useLogin";

interface LoginContextType extends UseFormReturn<LoginFormData> {
  onSubmit: (data: LoginFormData) => void;
  isLoading: boolean;
  globalError: string | null;
}

const LoginContext = createContext<LoginContextType | undefined>(undefined);

export function LoginProvider({ children }: { children: ReactNode }) {
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const loginMutation = useLoginMutation();

  const globalError = useMemo(() => {
    if (!loginMutation.error) return null;
    const err = loginMutation.error;
    if (err instanceof AxiosError) {
      if (err.response?.status === 401) return "Invalid email or password";
      if (err.response?.data?.message) return err.response.data.message as string;
      return "Connection failed. Please try again.";
    }
    return "An unexpected error occurred";
  }, [loginMutation.error]);

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <LoginContext.Provider value={{ ...form, onSubmit, isLoading: loginMutation.isPending, globalError }}>
      {children}
    </LoginContext.Provider>
  );
}

export function useLogin() {
  const context = useContext(LoginContext);
  if (!context) {
    throw new Error("useLogin must be used within a LoginProvider");
  }
  return context;
}
