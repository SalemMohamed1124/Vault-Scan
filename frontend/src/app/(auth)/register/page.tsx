"use client";

import { RegisterProvider } from "@/Features/authentication/Register/RegisterContext";
import { RegisterForm } from "@/Features/authentication/Register/RegisterForm";
import { AuthInfoPanel } from "@/Features/authentication/Shared/AuthInfoPanel";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <div className="flex flex-1 items-center justify-center p-4">
        <RegisterProvider>
          <RegisterForm />
        </RegisterProvider>
      </div>
      <AuthInfoPanel />
    </div>
  );
}
