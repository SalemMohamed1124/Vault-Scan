"use client";

import { RegisterProvider } from "@/Features/authentication/Register/RegisterContext";
import { RegisterForm } from "@/Features/authentication/Register/RegisterForm";
import { AuthInfoPanel } from "@/Features/authentication/Shared/AuthInfoPanel";

export default function RegisterPage() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden animate-fade-in">
      <AuthInfoPanel />
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-12 overflow-y-auto">
        <RegisterProvider>
          <RegisterForm />
        </RegisterProvider>
      </div>
    </div>
  );
}
