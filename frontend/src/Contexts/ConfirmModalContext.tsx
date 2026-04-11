"use client";

import { createContext, useContext, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description: string;
  children?: React.ReactNode;
  variant?: "confirm" | "danger";
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
};

type ConfirmModalContextProps = {
  confirm: (options: ConfirmOptions) => void;
  setIsPending: (pending: boolean) => void;
};

const ConfirmContext = createContext<ConfirmModalContextProps | null>(null);

export function ConfirmContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  function confirm(newOptions: ConfirmOptions) {
    setOptions(newOptions);
    setIsOpen(true);
  }

  function handleClose() {
    if (!isPending) {
      setIsOpen(false);
      setOptions(null);
    }
  }

  async function handleConfirm() {
    setIsPending(true);
    if (!options) return;
    try {
      await options.onConfirm();
    } finally {
      setIsPending(false);
      setIsOpen(false);
      setOptions(null);
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm, setIsPending }}>
      {children}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:rounded-lg overflow-hidden">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle className="text-lg">{options?.title}</DialogTitle>
            <DialogDescription className="mt-2 text-[14px]">
              {options?.description}
            </DialogDescription>
          </DialogHeader>
          {options?.children && (
            <div className="px-6 pb-4">{options.children}</div>
          )}
          <DialogFooter className="px-6 py-4 bg-muted/20">
            <Button
              disabled={isPending}
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              variant={
                options?.variant === "danger" ? "destructive" : "default"
              }
            >
              {isPending ? <Spinner /> : options?.confirmText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context)
    throw new Error("useConfirm must be used within a ConfirmProvider");
  return context;
}
