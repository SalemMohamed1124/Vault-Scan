import { useState } from "react";
import { NavLink, useNavigate } from "react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

import { ScrollArea } from "../ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

import { NAV_LINKS } from "@/Constants/NAV_LINKS";

import { User, BadgeCheck, Bell, LogOut, ArrowRightLeft, Check, Shield, ChevronsUpDown, Sun, Moon, Monitor } from "lucide-react";

import { useTheme } from "@/Contexts/ThemeContext";

// =======================
// Dummy Data
// =======================
const organizations = [
  { id: 1, name: "Acme Corporation", role: "Admin" },
  { id: 2, name: "Tech Startup Inc", role: "Editor" },
  { id: 3, name: "Enterprise Solutions", role: "Viewer" },
  { id: 4, name: "Another Org", role: "Viewer" },
  { id: 5, name: "Another Org", role: "Viewer" },
];

// =======================
// Main Sidebar
// =======================
export default function AppSidebar() {
  const { setOpenMobile, isMobile, setOpen, state, isPinned } = useSidebar();
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMouseEnter = () => {
    if (!isMobile && !isPinned && state === "collapsed") {
      setIsHovered(true);
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile && isHovered && !isPinned) {
      setIsHovered(false);
      setOpen(false);
      if (!isPinned && isMenuOpen) {
        setIsMenuOpen(false);
      }
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      overlay={!isPinned && isHovered}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="z-30 border-r border-sidebar-border bg-sidebar"
    >
      {isMobile && <Header />}
      <Content isMobile={isMobile} setOpenMobile={setOpenMobile} />
      <Footer isMobile={isMobile} setOpenMobile={setOpenMobile} isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
    </Sidebar>
  );
}

// =======================
// Header
// =======================
function Header() {
  return (
    <SidebarHeader className="flex h-10 items-center justify-center border-b p-0 bg-sidebar ">
      <SidebarMenu className="w-full">
        <SidebarMenuItem className="flex items-center justify-center gap-3 group-data-[collapsible=icon]:gap-0 px-2">
          <Shield className="size-6 text-blue-400 shrink-0" />
          <span className="text-lg font-bold truncate group-data-[collapsible=icon]:hidden">VulnScanner</span>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

// =======================
// Content
// =======================
type ContentProps = {
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
};

function Content({ setOpenMobile, isMobile }: ContentProps) {
  return (
    <SidebarContent className="overflow-x-hidden pt-4 bg-sidebar">
      {NAV_LINKS.map((group) => (
        <SidebarGroup key={group.group} className="group-data-[collapsible=icon]:py-0">
          <SidebarGroupLabel>{group.group}</SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.link}>
                  <NavLink to={item.link}>
                    {({ isActive }) => (
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className={`px-5 py-3 transition-all cursor-pointer rounded-none border-l-2 ${
                          isActive
                            ? "bg-primary/10 text-primary border-chart-4 dark:border-primary font-bold"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/30 hover:text-foreground border-transparent font-medium"
                        }`}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  );
}

// =======================
// Footer
// =======================
type FooterProps = {
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
};

function Footer({ setOpenMobile, isMobile, isMenuOpen, setIsMenuOpen }: FooterProps) {
  const [activeOrg, setActiveOrg] = useState("1");
  const { setTheme, theme } = useTheme();
  const navigate = useNavigate();

  return (
    <SidebarFooter className="border-t  p-2   ">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu modal={isMobile} open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton size="lg" className="cursor-pointer">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full dark:bg-gray-200 bg-blue-500 background text-primary-foreground">
                  <User className="size-5" />
                </div>

                <div className="flex-1 min-w-0 text-left text-sm group-data-[collapsible=icon]:hidden">
                  <p className="truncate font-semibold">salem</p>
                  <p className="truncate text-xs text-muted-foreground">salem@gmail.com</p>
                </div>
                <div className="group-data-[collapsible=icon]:hidden ">
                  <ChevronsUpDown className="size-5 text-muted-foreground " />
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align="center"
              className="mb-2 w-65 sm:w-60 rounded-xl border bg-popover p-2 shadow-md "
            >
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                <ArrowRightLeft className="size-3" />
                Switch Organization
              </div>

              <ScrollArea className="h-48">
                <RadioGroup value={activeOrg} onValueChange={setActiveOrg}>
                  {organizations.map((org) => (
                    <DropdownMenuItem
                      key={org.id}
                      className="p-0 focus:bg-transparent"
                      onSelect={(e) => {
                        e.preventDefault();
                        setActiveOrg(org.id.toString());
                        if (isMobile) setTimeout(() => setOpenMobile(false), 100);
                      }}
                    >
                      <label
                        htmlFor={`org-${org.id}`}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 cursor-pointer hover:bg-accent"
                      >
                        <div className="flex size-8 items-center justify-center rounded-lg border bg-background text-xs font-bold">
                          {org.name[0]}
                        </div>

                        <div className="flex-1 overflow-hidden">
                          <p className="truncate text-sm font-medium">{org.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">{org.role}</p>
                        </div>

                        <RadioGroupItem id={`org-${org.id}`} value={org.id.toString()} className="peer sr-only" />
                        <Check className="size-4 text-primary opacity-0 peer-data-[state=checked]:opacity-100" />
                      </label>
                    </DropdownMenuItem>
                  ))}
                </RadioGroup>
              </ScrollArea>

              <DropdownMenuSeparator />

              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase text-muted-foreground">
                Theme
              </div>
              <DropdownMenuGroup className="*:flex *:items-center *:gap-2 *:cursor-pointer *:text-sm *:text-muted-foreground ">
                <DropdownMenuItem onClick={() => setTheme("light")} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sun className="size-4" /> Light
                  </div>
                  {theme === "light" && <Check className="  size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className="size-4" /> Dark
                  </div>
                  {theme === "dark" && <Check className="size-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="size-4" /> System
                  </div>
                  {theme === "system" && <Check className="size-4" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup className="*:flex *:items-center *:gap-2 *:cursor-pointer *:text-sm *:text-muted-foreground ">
                <DropdownMenuItem className="gap-2" onClick={() => navigate("/history/notifications")}>
                  <Bell className="size-4 text-inherit" /> Notifications
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <BadgeCheck className="size-4 text-inherit" /> Account
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="size-4 text-inherit" /> Log out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
