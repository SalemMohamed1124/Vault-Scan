"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { NAV_LINKS } from "@/Constants/NAV_LINKS";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // Create flat list for searching
  const flattenedNav = NAV_LINKS.flatMap((section) => section.items);

  // Listen for Ctrl+K / Cmd+K and "/" key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // "/" key opens search when not focused on an input
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName,
        )
      ) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Navigate to a page"
      className="p-1"
    >
      <Command>
        <CommandInput
          placeholder="Search pages..."
          className="focus-none rounded-"
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {flattenedNav.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                   key={item.link}
                   onSelect={() => navigate(item.link)}
                   className="cursor-pointer"
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
