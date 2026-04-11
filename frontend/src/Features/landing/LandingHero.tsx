import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { stats } from "./constants";
import CountUp from "@/components/ui/CountUp";

export function LandingHero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 bg-transparent">
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-muted border border-border px-3 py-1 mb-8 animate-fade-in-up">
          <div className="h-1.5 w-1.5 bg-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            AI-Powered Vulnerability Scanner
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-[1.1] tracking-tighter mb-6 animate-fade-in-up stagger-1">
          Discover vulnerabilities
          <br />
          <span className="text-primary">
            before attackers do
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up stagger-2">
          Comprehensive security scanning with 20+ automated checks, AI-powered
          analysis, and real-time progress tracking. Protect your web
          applications, APIs, and infrastructure.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up stagger-3">
          <Link
            href="/register"
            className="group flex items-center gap-2 text-base font-bold text-primary-foreground bg-primary px-8 py-3.5 transition-all"
          >
            Start Scanning Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 text-base font-medium text-muted-foreground border border-border px-8 py-3.5 transition-all hover:bg-muted"
          >
            See How It Works
          </a>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 max-w-3xl mx-auto animate-fade-in-up stagger-4">
          {stats.map((stat) => {
            const isUptime = stat.label.includes("UPTIME");
            const isTime = stat.label.includes("TIME");
            const isSecurity = stat.label.includes("SCRIPTS");
            const isCategories = stat.label.includes("CATEGORIES");

            return (
              <div key={stat.label} className="text-center group">
                <div className="text-3xl md:text-4xl font-black text-foreground mb-2 flex items-center justify-center tracking-tighter">
                  {isTime && <span className="text-primary mr-1">&lt;</span>}
                  <CountUp
                    from={0}
                    to={parseFloat(stat.value.replace(/[^0-9.]/g, ""))}
                    duration={2}
                    separator=","
                    className="tabular-nums"
                  />
                  {(isSecurity || isCategories) && <span className="text-primary ml-1">+</span>}
                  {isUptime && <span className="text-primary ml-1">%</span>}
                  {isTime && <span className="text-primary ml-1 text-xl">min</span>}
                </div>
                <div className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] leading-none opacity-80 group-hover:text-primary transition-colors">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
