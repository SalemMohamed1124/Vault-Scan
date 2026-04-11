import { createContext, useContext, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type ViewOptions = {
  title?: string;
  description?: string;
  content: React.ReactNode;
  defaultScroll?: boolean; // true = modal handles scrolling, false = form handles its own
  className?: string;
};

type ViewModalContextProps = {
  view: (options: ViewOptions) => void;
  close: () => void;
};

const ViewModalContext = createContext<ViewModalContextProps | null>(null);

export function ViewModalContextProvider({ children }: { children: React.ReactNode }) {
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
          className={cn(
            "p-0 grid gap-0 max-h-[min(80dvh,700px)] grid-rows-[auto_1fr]",

            options?.className
          )}
        >
          {options?.title ? (
            <DialogHeader className="px-6 py-4 border-b shrink-0 text-start">
              <DialogTitle className="text-xl font-bold">{options.title}</DialogTitle>
              {options.description ? (
                <DialogDescription>{options.description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">Modal description for {options.title}</DialogDescription>
              )}
            </DialogHeader>
          ) : (
            <DialogHeader className="sr-only">
              <DialogTitle>Modal Dialog</DialogTitle>
              <DialogDescription>Content for the modal dialog</DialogDescription>
            </DialogHeader>
          )}

          {useDefaultScroll ? <ScrollArea className="min-h-0 px-3 py-3">{options?.content}</ScrollArea> : <>{options?.content}</>}
          <div id="modal-portal-container" />
        </DialogContent>
      </Dialog>
    </ViewModalContext.Provider>
  );
}

export function useViewModal() {
  const context = useContext(ViewModalContext);
  if (!context) throw new Error("useViewModal must be used within a ViewModalContextProvider");
  return context;
}
