import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { features } from "./constants";

export function LandingFeatures() {
  return (
    <section id="features" className="relative py-24 md:py-32 bg-transparent">
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-muted border border-border px-3 py-1 mb-4">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Features
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need for
            <br className="hidden sm:block" />
            <span className="text-primary">
              {" "}
              comprehensive security
            </span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From automated scanning to AI-powered analysis, VaultScan gives you
            the tools to identify, prioritize, and fix vulnerabilities across
            your entire attack surface.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={cn(
                "group flex flex-col items-center text-center border border-border bg-muted/50 p-7 transition-all hover:bg-card",
                `stagger-${(i % 5) + 1} animate-fade-in-up`,
              )}
            >
              <div
                className={cn(
                  "h-14 w-14 flex items-center justify-center mb-6 bg-primary/10 rounded-full group-hover:scale-110 transition-transform",
                )}
              >
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
