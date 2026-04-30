"use client";

import { createContext, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ViewOptions = {
  title?: string;
  description?: React.ReactNode;
  content: React.ReactNode;
  defaultScroll?: boolean;
  className?: string;
  maxWidth?: string;
  maxHeight?: string;
  noPadding?: boolean;
  hideCloseButton?: boolean;
};

type ViewModalContextProps = {
  view: (options: ViewOptions) => void;
  close: () => void;
};

const ViewModalContext = createContext<ViewModalContextProps | null>(null);

export function ViewModalContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ViewOptions | null>(null);

  const view = (newOptions: ViewOptions) => {
    setOptions(newOptions);
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    setOptions(null);
  };

  // Default to true if not specified
  const useDefaultScroll = options?.defaultScroll !== false;

  return (
    <ViewModalContext.Provider value={{ view, close }}>
      {children}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={!options?.hideCloseButton}
          className={cn(
            "p-0 flex flex-col overflow-hidden",
            options?.maxHeight || "max-h-[min(90dvh,850px)]",
            options?.maxWidth || "sm:max-w-lg",
            options?.className
          )}
        >
          {options?.title ? (
            <DialogHeader className="px-6 py-5 border-b border-border shrink-0 text-start dark:border-[#30363d] bg-muted/10">
              <DialogTitle className="text-xl font-black tracking-tight leading-none text-foreground">
                {options.title}
              </DialogTitle>
              {options.description ? (
                <div className="text-xs text-muted-foreground mt-1 tracking-tight">
                    {options.description}
                </div>
              ) : (
                <DialogDescription className="sr-only">
                  Modal description for {options.title}
                </DialogDescription>
              )}
            </DialogHeader>
          ) : (
            <DialogHeader className="sr-only">
              <DialogTitle>Modal Dialog</DialogTitle>
              <DialogDescription>
                Content for the modal dialog
              </DialogDescription>
            </DialogHeader>
          )}

          <div className={cn(
            "flex-1 overflow-y-auto min-h-0",
            options?.noPadding === false && "px-6 py-6 pb-8",
            useDefaultScroll ? "custom-scrollbar" : ""
          )}>
            {options?.content}
          </div>
          <div id="modal-portal-container" />
        </DialogContent>
      </Dialog>
    </ViewModalContext.Provider>
  );
}

export function useViewModal() {
  const context = useContext(ViewModalContext);
  if (!context)
    throw new Error(
      "useViewModal must be used within a ViewModalContextProvider"
    );
  return context;
}
