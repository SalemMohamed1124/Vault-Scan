"use client";

import { useLogin } from "./LoginContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Shield, Mail, Lock, CheckCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export function LoginForm() {
  return (
    <div className="w-full max-w-[420px] mx-auto animate-fade-in-up px-4 sm:px-0">
      {/* Brand Header - Hidden on desktop in split layout */}
      <Link href="/" className="flex lg:hidden items-center gap-3 mb-8 group cursor-pointer w-fit mx-auto transition-transform active:scale-95 focus:outline-none">
        <div className="flex h-10 w-10 items-center justify-center bg-primary">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">VaultScan</h2>
      </Link>

      <div className="w-full">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tighter">Welcome back</h1>
          <p className="mt-2 text-[13px] sm:text-[14px] text-muted-foreground font-medium">
            Let&apos;s get you back into your security dashboard.
          </p>
        </div>

        <LoginFormInner />
      </div>

      <p className="text-center text-[12px] sm:text-[13px] text-muted-foreground mt-6">
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
        <div className="flex items-center gap-2 border border-destructive/20 px-4 py-3 text-[13px] text-destructive bg-destructive/5">
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
        className="h-11 w-full font-bold text-[14px]"
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
      <FieldLabel className="text-[13px] font-semibold text-foreground/80 mb-2">Email Address</FieldLabel>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input 
          autoFocus
          placeholder="you@company.com" 
          {...register("email")} 
          className="h-11 bg-transparent pl-10 border-border/60 focus:border-primary/50 focus-visible:ring-primary/10 transition-all" 
        />
      </div>
      <FieldError errors={[errors.email]} />
    </Field>
  );
}

function PasswordField() {
  const { register, formState: { errors } } = useLogin();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Field>
      <div className="flex items-center justify-between mb-2">
        <FieldLabel className="text-[13px] font-semibold text-foreground/80 mb-0">Password</FieldLabel>
        <span 
          className="text-[11px] font-bold text-primary cursor-pointer hover:text-primary/80 transition-colors uppercase tracking-tight"
          onClick={() => toast.info("Password reset is not yet available.")}
        >
          Forgot?
        </span>
      </div>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
        <Input 
          type={showPassword ? "text" : "password"}
          placeholder="••••••••" 
          {...register("password")} 
          className="h-11 bg-transparent pl-10 pr-10 border-border/60 focus:border-primary/50 focus-visible:ring-primary/10 transition-all" 
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
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
