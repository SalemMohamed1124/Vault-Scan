import { Bug, CheckCircle2 } from "lucide-react";
import { scanTypes } from "./constants";

export function LandingScanTypes() {
  return (
    <section id="scan-types" className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-violet-500/2 to-transparent" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-muted border border-border px-3 py-1 mb-4">
            <Bug className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Scan Types
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Choose your
            <span className="text-primary">
              {" "}
              scan depth
            </span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Quick scans for fast checks, deep scans for thorough OWASP Top 10
            coverage.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {scanTypes.map((type) => (
            <div
              key={type.name}
              className="relative   border border-border p-7 transition-all bg-muted/50 hover:bg-card"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 bg-primary flex items-center justify-center">
                  <type.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {type.name}
                  </h3>
                  <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                    {type.time}
                  </span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                {type.description}
              </p>

              <div className="flex flex-wrap gap-2">
                {type.checks.map((check) => (
                  <span
                    key={check}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted border border-border px-2.5 py-1"
                  >
                    <CheckCircle2 className="h-3 w-3 text-primary" />
                    {check}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
