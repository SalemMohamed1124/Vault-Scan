"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="size-9 shrink-0" />;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center justify-center size-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted transition-colors cursor-pointer relative overflow-hidden"
      aria-label="Toggle theme"
    >
      <Sun
        className={`size-[18px] transition-all duration-300 absolute ${
          theme === "light"
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        }`}
      />
      <Moon
        className={`size-[18px] transition-all duration-300 absolute ${
          theme === "dark"
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        }`}
      />
      <Monitor
        className={`size-[18px] transition-all duration-300 absolute ${
          theme === "system"
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        }`}
      />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
