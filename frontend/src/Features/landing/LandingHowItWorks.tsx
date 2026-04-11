import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { steps } from "./constants";

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32 bg-transparent">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-24 cursor-default">
          <div className="inline-flex items-center gap-2 bg-muted border border-border px-3 py-1 mb-4">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              How It Works
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Three steps to
            <span className="text-primary">
              {" "}
              secure your assets
            </span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Get from zero to full security visibility in minutes, not weeks.
          </p>
        </div>

        {/* Scroll Stack Container */}
        <div className="relative flex flex-col gap-8 md:gap-16 pb-12 w-full max-w-4xl mx-auto">
          {steps.map((item, i) => (
            <div
              key={item.step}
              className={cn(
                "sticky w-full rounded-2xl border border-border bg-card p-8 md:p-12",
                "flex flex-col md:flex-row items-center gap-8 md:gap-16"
              )}
              style={{
                // Magic offset! Each card stops exactly 1.5rem (24px) below the previous one
                top: `calc(8rem + ${i * 1.5}rem)`,
                zIndex: i + 1,
              }}
            >
              
              {/* Giant Step Number Background */}
              <div className="absolute top-0 right-0 -mr-4 -mt-8 md:mr-8 md:mt-4 pointer-events-none select-none opacity-5 dark:opacity-[0.03]">
                <span className="text-[140px] md:text-[200px] font-black leading-none text-foreground tracking-tighter">
                  {item.step}
                </span>
              </div>

              {/* Icon Container */}
              <div className="flex-shrink-0 relative z-10">
                <div className="h-24 w-24 md:h-32 md:w-32 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center shadow-inner">
                  <item.icon className="h-10 w-10 md:h-14 md:w-14 text-primary" />
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col flex-1 text-center md:text-left relative z-10">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shadow-md">
                    {item.step}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground">
                    {item.title}
                  </h3>
                </div>
                <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
                  {item.description}
                </p>
              </div>

            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
