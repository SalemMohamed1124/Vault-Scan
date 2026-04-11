"use client";

import { useLogin } from "./LoginContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Shield, Mail, Lock, CheckCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function LoginForm() {
  return (
    <div className="w-full max-w-[420px] mx-auto animate-fade-in-up">
      {/* Logo & Header */}
      <Link href="/" className="flex flex-col items-center gap-3 mb-8 group cursor-pointer w-fit mx-auto transition-transform active:scale-95 focus:outline-none">
        <div className="flex h-14 w-14 items-center justify-center bg-linear-to-br from-primary to-cyan-500 shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300">
          <Shield className="h-7 w-7 text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">VaultScan</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            AI-Powered Vulnerability Scanner
          </p>
        </div>
      </Link>

      <div className="bg-card border border-border p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Sign in to your account
          </p>
        </div>

        <LoginFormInner />
      </div>

      <p className="text-center text-[13px] text-muted-foreground mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Create one
        </Link>
      </p>
    </div>
  );
}

function LoginFormInner() {
  const { handleSubmit, onSubmit, isLoading, globalError } = useLogin();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {globalError && (
        <div className="flex items-center gap-2 border border-destructive/20 px-4 py-3 text-[13px] text-destructive bg-destructive/10">
          <div className="h-1.5 w-1.5 bg-destructive shrink-0" />
          {globalError}
        </div>
      )}

      <EmailField />
      <PasswordField />
      <RememberMeField />

      <Button
        type="submit"
        disabled={isLoading}
        variant="primary"
        className="h-11 w-full font-semibold text-[14px]"
      >
        {isLoading ? (
          <>
            <Spinner className="mr-2" />
            Signing in...
          </>
        ) : (
          <span className="flex items-center gap-2">
            Sign In
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  );
}

function EmailField() {
  const { register, formState: { errors } } = useLogin();
  return (
    <Field>
      <FieldLabel className="text-[13px] font-medium text-foreground mb-2">Email</FieldLabel>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          autoFocus
          placeholder="you@company.com" 
          {...register("email")} 
          className="h-11 bg-muted/50 pl-10 focus-visible:ring-primary/20" 
        />
      </div>
      <FieldError errors={[errors.email]} />
    </Field>
  );
}

function PasswordField() {
  const { register, formState: { errors } } = useLogin();
  return (
    <Field>
      <div className="flex items-center justify-between mb-2">
        <FieldLabel className="text-[13px] font-medium text-foreground mb-0">Password</FieldLabel>
        <span 
          className="text-[12px] font-medium text-primary cursor-pointer hover:underline"
          onClick={() => toast.info("Password reset is not yet available.")}
        >
          Forgot password?
        </span>
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          type="password"
          placeholder="Enter your password" 
          {...register("password")} 
          className="h-11 bg-muted/50 pl-10 focus-visible:ring-primary/20" 
        />
      </div>
      <FieldError errors={[errors.password]} />
    </Field>
  );
}

function RememberMeField() {
  const { watch, setValue } = useLogin();
  const rememberMe = watch("rememberMe");

  return (
    <div className="flex items-center gap-2 mb-2 w-fit">
      <button
        type="button"
        onClick={() => setValue("rememberMe", !rememberMe)}
        className={cn(
          "flex h-4 w-4 items-center justify-center border transition-all",
          rememberMe
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-muted/50 hover:border-muted-foreground"
        )}
      >
        {rememberMe && <CheckCircle className="h-3 w-3" />}
      </button>
      <span
        className="text-[13px] text-muted-foreground cursor-pointer select-none"
        onClick={() => setValue("rememberMe", !rememberMe)}
      >
        Remember me
      </span>
    </div>
  );
}
