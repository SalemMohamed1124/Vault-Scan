"use client";

import { Brain, ShieldCheck, Activity, FileText, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description: "Advanced machine learning models analyze vulnerabilities and prioritize remediation.",
  },
  {
    icon: ShieldCheck,
    title: "20+ Security Checks",
    description: "Comprehensive scanning including SQL injection, XSS, CSRF, and more.",
  },
  {
    icon: Activity,
    title: "Real-time Monitoring",
    description: "Continuous monitoring with instant alerts when new threats are detected.",
  },
  {
    icon: FileText,
    title: "Compliance Reports",
    description: "Generate detailed reports for OWASP, PCI DSS, and custom frameworks.",
  },
];

function AbstractLogo({ variant }: { variant: number }) {
  const logos = [
    <svg key="hex" viewBox="0 0 32 32" className="h-5 w-5">
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="currentColor" opacity="0.3" />
    </svg>,
    <svg key="circ" viewBox="0 0 32 32" className="h-5 w-5">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.3" />
    </svg>,
    <svg key="grid" viewBox="0 0 32 32" className="h-5 w-5">
      <rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="18" y="2" width="12" height="12" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="2" y="18" width="12" height="12" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="18" y="18" width="12" height="12" rx="2" fill="currentColor" opacity="0.35" />
    </svg>,
    <svg key="tri" viewBox="0 0 32 32" className="h-5 w-5">
      <polygon points="16,4 28,28 4,28" fill="currentColor" opacity="0.3" />
    </svg>,
    <svg key="dia" viewBox="0 0 32 32" className="h-5 w-5">
      <polygon points="16,2 30,16 16,30 2,16" fill="currentColor" opacity="0.3" />
    </svg>,
  ];
  return logos[variant % logos.length];
}

export function AuthInfoPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 h-screen sticky top-0 flex-col justify-between overflow-hidden bg-muted/30 p-10 lg:p-14 border-r border-border animate-fade-in-up shrink-0">
      {/* Background patterns */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[10%] left-[10%] h-24 w-24 opacity-[0.05]">
          <Shield className="h-full w-full text-primary" />
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex h-12 w-12 items-center justify-center bg-primary">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tighter uppercase leading-none">VaultScan</h1>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Security Intelligence</p>
          </div>
        </div>
        <h2 className="text-4xl font-black text-foreground mb-4 tracking-tighter uppercase leading-[0.9]">
          Secure your <br/> digital assets.
        </h2>
        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-sm font-medium opacity-80">
          Enterprise-grade vulnerability scanning powered by artificial intelligence.
        </p>
      </div>

      <div className="relative z-10 flex flex-col gap-3 my-6 flex-1 justify-start">
        {features.map((feature, i) => (
          <div
            key={feature.title}
            className={cn(
              "flex items-start gap-4 p-5 bg-card border border-border transition-all hover:border-primary/30 group animate-fade-in-up"
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <feature.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-foreground">{feature.title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mt-1.5 font-medium line-clamp-2">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 pt-4 border-t border-border/40">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground/50 mb-4">
          Advanced Frameworks
        </p>
        <div className="flex items-center gap-5 text-muted-foreground/30">
          {[0, 1, 2, 3, 4].map((i) => (
            <AbstractLogo key={i} variant={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
