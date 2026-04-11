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
import type { Ip } from "@/Types/data-types";
import { useViewModal } from "@/Contexts/ViewModalContext";
import IpDetailView from "./IpDetailView";
import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";

type IpActionsProps = {
  ip: Ip;
};

function IpRowActions({ ip }: IpActionsProps) {
  const { view } = useViewModal();
  const { isMobile } = useSidebar();

  function handleShowMore() {
    view({
      title: "IP Details",
      content: <IpDetailView ip={ip} />,
    });
  }

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant={"outline"} size="sm" onClick={handleShowMore}>
          Show more
        </Button>
        <Button variant={"outline"} size="sm" onClick={() => toClipboard(ip.value, "IP Address copied to clipboard")}>
          <Copy />
          IP
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
          <DropdownMenuItem onClick={() => toClipboard(ip.value, "IP Address copied to clipboard")}>
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

export default IpRowActions;
