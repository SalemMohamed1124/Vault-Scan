import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy, Eye, MoreHorizontal } from "lucide-react";
import type { Port } from "@/Types/data-types";
import { useViewModal } from "@/Contexts/ViewModalContext";
import PortDetailView from "./PortDetailView";
import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";

type PortActionsProps = {
  port: Port;
};

function PortRowActions({ port }: PortActionsProps) {
  const { view } = useViewModal();
  const { isMobile } = useSidebar();

  function handleShowMore() {
    view({
      title: "Port Details",
      content: <PortDetailView port={port} />,
    });
  }

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant={"outline"} size="sm" onClick={handleShowMore} className="flex-1">
          Show more
        </Button>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => toClipboard(port.ip, "IP Address copied to clipboard")}>
            <Copy />
            Copy IP Address
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={handleShowMore}>
            <Eye />
            Show More
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export default PortRowActions;
