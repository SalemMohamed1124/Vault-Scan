"use client";

import { LoginProvider } from "@/Features/authentication/Login/LoginContext";
import { LoginForm } from "@/Features/authentication/Login/LoginForm";
import { AuthInfoPanel } from "@/Features/authentication/Shared/AuthInfoPanel";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <AuthInfoPanel />
      <div className="flex flex-1 items-center justify-center p-4">
        <LoginProvider>
          <LoginForm />
        </LoginProvider>
      </div>
    </div>
  );
}
