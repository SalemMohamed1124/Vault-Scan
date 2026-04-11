import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Copy } from "lucide-react";
import type { Domain } from "@/Types/data-types";
import { useViewModal } from "@/Contexts/ViewModalContext";
import DomainDetailView from "./DomainDetailView";
import { useSidebar } from "@/components/ui/sidebar";
import { toClipboard } from "@/lib/utils";

type DomainActionsProps = {
  domain: Domain;
};

function DomainRowActions({ domain }: DomainActionsProps) {
  const { view } = useViewModal();
  const { isMobile } = useSidebar();

  function handleShowMore() {
    view({
      title: "Domain Details",
      content: <DomainDetailView domain={domain} />,
    });
  }

  if (isMobile) {
    return (
      <div className="flex gap-2 w-full flex-wrap *:flex-1">
        <Button variant={"outline"} size={"sm"} onClick={handleShowMore} className="flex-1">
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
          <DropdownMenuItem onClick={() => toClipboard(domain.ip, "IP Address copied to clipboard")}>
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

export default DomainRowActions;
