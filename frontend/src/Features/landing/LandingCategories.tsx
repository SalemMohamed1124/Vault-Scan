import { cn } from "@/lib/utils";
import { categories } from "./constants";

export function LandingCategories() {
  return (
    <section className="relative py-24 md:py-32 bg-transparent">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Vulnerability Categories
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Covering the full spectrum of web application and infrastructure
            vulnerabilities.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="group flex flex-col items-center text-center border border-border bg-muted/50 p-7 transition-all hover:bg-card"
            >
              <cat.icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold text-foreground mb-1">
                {cat.name}
              </span>
              <span
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5",
                  cat.severity === "Critical" && "text-red-500 bg-red-500/10",
                  cat.severity === "High" && "text-orange-500 bg-orange-500/10",
                  cat.severity === "Medium" &&
                    "text-yellow-600 bg-yellow-500/10",
                  cat.severity === "Varies" && "text-muted-foreground bg-muted",
                )}
              >
                {cat.severity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
