"use client";

import { useRegister } from "./RegisterContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

const strengthConfig = {
  weak: {
    label: "Weak",
    color: "text-red-400",
    barColor: "bg-red-400",
    width: "w-1/3",
  },
  medium: {
    label: "Medium",
    color: "text-yellow-400",
    barColor: "bg-yellow-400",
    width: "w-2/3",
  },
  strong: {
    label: "Strong",
    color: "text-green-400",
    barColor: "bg-green-400",
    width: "w-full",
  },
} as const;

export function RegisterForm() {
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
          <h1 className="text-xl font-semibold text-foreground">Create Account</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Get started with VaultScan
          </p>
        </div>

        <RegisterFormInner />
      </div>

      <p className="text-center text-[13px] text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function RegisterFormInner() {
  const { handleSubmit, onSubmit, isLoading, globalError } = useRegister();

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {globalError && (
        <div className="flex items-center gap-2 border border-destructive/20 px-4 py-3 text-[13px] text-destructive bg-destructive/10">
          <div className="h-1.5 w-1.5 bg-destructive shrink-0" />
          {globalError}
        </div>
      )}

      <NameField />
      <EmailField />
      <PasswordField />

      <Button
        type="submit"
        disabled={isLoading}
        variant="primary"
        className="h-11 w-full font-semibold text-[14px]"
      >
        {isLoading ? (
          <>
            <Spinner className="mr-2" />
            Creating account...
          </>
        ) : (
          <span className="flex items-center gap-2">
            Create Account
            <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </Button>
    </form>
  );
}

function NameField() {
  const { register, formState: { errors } } = useRegister();
  return (
    <Field>
      <FieldLabel className="text-[13px] font-medium text-foreground mb-2">Name</FieldLabel>
      <Input 
        autoFocus
        placeholder="John Doe" 
        {...register("name")} 
        className="h-11 bg-muted/50 focus-visible:ring-primary/20" 
      />
      <FieldError errors={[errors.name]} />
    </Field>
  );
}

function EmailField() {
  const { register, formState: { errors } } = useRegister();
  return (
    <Field>
      <FieldLabel className="text-[13px] font-medium text-foreground mb-2">Email</FieldLabel>
      <Input 
        placeholder="you@company.com" 
        {...register("email")} 
        className="h-11 bg-muted/50 focus-visible:ring-primary/20" 
      />
      <FieldError errors={[errors.email]} />
    </Field>
  );
}

function PasswordField() {
  const { register, formState: { errors }, passwordStrength, watch } = useRegister();
  const password = watch("password");
  const strengthInfo = strengthConfig[passwordStrength];

  return (
    <Field>
      <FieldLabel className="text-[13px] font-medium text-foreground mb-2">Password</FieldLabel>
      <Input 
        type="password"
        placeholder="Min. 8 characters" 
        {...register("password")} 
        className="h-11 bg-muted/50 focus-visible:ring-primary/20" 
      />
      
      {password?.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="h-1 w-full bg-border overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strengthInfo.barColor} ${strengthInfo.width}`}
            />
          </div>
          <span className={`text-[11px] ${strengthInfo.color}`}>
            {strengthInfo.label}
            {passwordStrength === "weak" && " — at least 8 characters"}
            {passwordStrength === "medium" && " — add uppercase & number for strong"}
          </span>
        </div>
      )}

      <FieldError errors={[errors.password]} />
    </Field>
  );
}
