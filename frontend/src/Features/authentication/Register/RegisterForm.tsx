"use client";

import { useRegister } from "./RegisterContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Shield, ArrowRight, Eye, EyeOff, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
          <h1 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tighter">Create Account</h1>
          <p className="mt-2 text-[13px] sm:text-[14px] text-muted-foreground font-medium">
            Join the elite network of security researchers.
          </p>
        </div>

        <RegisterFormInner />
      </div>

      <p className="text-center text-[12px] sm:text-[13px] text-muted-foreground mt-6">
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
        <div className="flex items-center gap-2 border border-destructive/20 px-4 py-3 text-[13px] text-destructive bg-destructive/5">
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
        className="h-11 w-full font-bold text-[14px]"
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
      <FieldLabel className="text-[13px] font-semibold text-foreground/80 mb-2">Full Name</FieldLabel>
      <Input 
        autoFocus
        placeholder="John Doe" 
        {...register("name")} 
        className="h-11 bg-transparent border-border/60 focus:border-primary/50 focus-visible:ring-primary/10 transition-all" 
      />
      <FieldError errors={[errors.name]} />
    </Field>
  );
}

function EmailField() {
  const { register, formState: { errors } } = useRegister();
  return (
    <Field>
      <FieldLabel className="text-[13px] font-semibold text-foreground/80 mb-2">Email Address</FieldLabel>
      <Input 
        placeholder="you@company.com" 
        {...register("email")} 
        className="h-11 bg-transparent border-border/60 focus:border-primary/50 focus-visible:ring-primary/10 transition-all" 
      />
      <FieldError errors={[errors.email]} />
    </Field>
  );
}

function PasswordField() {
  const { register, formState: { errors }, passwordStrength, watch } = useRegister();
  const password = watch("password");
  const strengthInfo = strengthConfig[passwordStrength];
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Field>
      <FieldLabel className="text-[13px] font-semibold text-foreground/80 mb-2">Password</FieldLabel>
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
