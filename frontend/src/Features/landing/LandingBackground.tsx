"use client";

import { useTheme } from "next-themes";
import DotGrid from "@/components/ui/DotGrid";
import { useEffect, useState } from "react";

export function LandingBackground() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  // Theme-aware color configuration
  const isDark = resolvedTheme === "dark";
  
  // Custom colors for light/dark modes that match the brand theme
  const baseColor = isDark ? "#334155" : "#94a3b8"; // Higher contrast grey for Light Mode
  const activeColor = isDark ? "#818cf8" : "#3730a3"; // Deep indigo for Light Mode active state

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <DotGrid
        dotSize={5}
        gap={15}
        baseColor={baseColor}
        activeColor={activeColor}
        proximity={120}
        shockRadius={250}
        shockStrength={5}
        resistance={750}
        returnDuration={1.5}
      />
    </div>
  );
}
