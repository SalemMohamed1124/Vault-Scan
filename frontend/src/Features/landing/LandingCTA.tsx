import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2 } from "lucide-react";

export function LandingCTA() {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden">
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        
        {/* Animated Icon/Badge like Hero */}
        <div className="inline-flex items-center justify-center h-16 w-16 bg-primary/10 rounded-full mb-8 animate-fade-in-up">
          <Shield className="h-8 w-8 text-primary" />
        </div>

        <h2 className="text-4xl md:text-6xl font-bold text-foreground leading-[1.1] tracking-tighter mb-6 animate-fade-in-up stagger-1">
          Ready to secure your
          <br />
          <span className="text-primary">
            application?
          </span>
        </h2>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up stagger-2">
          Start scanning in minutes. No credit card required. Get actionable
          security insights today with our AI-powered platform.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up stagger-3">
          <Link
            href="/register"
            className="group flex items-center gap-2 text-base font-bold text-primary-foreground bg-primary px-10 py-4 transition-all"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 text-base font-medium text-muted-foreground border border-border px-10 py-4 hover:bg-muted transition-all"
          >
            Sign In
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 animate-fade-in-up stagger-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            No credit card
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Setup in 2 mins
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            OWASP Coverage
          </div>
        </div>
      </div>
    </section>
  );
}
