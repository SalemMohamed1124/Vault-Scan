"use client";

import { LoginProvider } from "@/Features/authentication/Login/LoginContext";
import { LoginForm } from "@/Features/authentication/Login/LoginForm";
import { AuthInfoPanel } from "@/Features/authentication/Shared/AuthInfoPanel";

export default function LoginPage() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden animate-fade-in">
      <AuthInfoPanel />
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-12 overflow-y-auto">
        <LoginProvider>
          <LoginForm />
        </LoginProvider>
      </div>
    </div>
  );
}
