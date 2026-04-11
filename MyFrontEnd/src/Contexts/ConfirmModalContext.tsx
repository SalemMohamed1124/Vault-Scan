import { createContext, useContext, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogFooter, DialogHeader, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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
  setIsloading: (any: boolean) => void;
};

const ConfirmContext = createContext<ConfirmModalContextProps | null>(null);

export function ConfirmContextProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsloading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  function confirm(newOptions: ConfirmOptions) {
    setOptions(newOptions);
    setIsOpen(true);
  }

  function handleClose() {
    if (!isLoading) {
      setIsOpen(false);
      setOptions(null);
    }
  }

  async function handleConfirm() {
    setIsloading(true);
    if (!options) return;
    try {
      await options.onConfirm();
    } finally {
      setIsloading(false);
      setIsOpen(false);
      setOptions(null);
    }
  }

  return (
    <ConfirmContext.Provider value={{ confirm, setIsloading }}>
      {children}

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{options?.title}</DialogTitle>
            <DialogDescription>{options?.description}</DialogDescription>
          </DialogHeader>
          {options?.children}
          <DialogFooter>
            <Button disabled={isLoading} variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading}
              variant={options?.variant === "danger" ? "destructive" : "default"}
            >
              {isLoading ? <Spinner /> : options?.confirmText || "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used within a ConfirmProvider");
  return context;
}
