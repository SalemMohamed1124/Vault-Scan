"use client";

import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmContextProvider } from "@/Contexts/ConfirmModalContext";
import { ViewModalContextProvider } from "@/Contexts/ViewModalContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConfirmContextProvider>
            <ViewModalContextProvider>{children}</ViewModalContextProvider>
          </ConfirmContextProvider>
        </TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
        <ReactQueryDevtools
          initialIsOpen={false}
          position="bottom"
          client={queryClient}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
