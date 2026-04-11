import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  variant?: "default" | "danger";
  loading?: boolean;
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone.",
  variant = "default",
  loading = false,
}: ConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className={cn(variant === "danger" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          >
            {loading ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {variant === "danger" ? "Delete" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
