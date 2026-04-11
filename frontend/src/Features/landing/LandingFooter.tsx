import Link from "next/link";
import { Shield } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="relative z-10 py-12 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8 mb-10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-8 w-8 bg-primary flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground">
                VaultScan
              </span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              AI-powered vulnerability scanning platform for modern security
              teams.
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="#features"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Features
                </a>
              </li>
              <li>
                <a
                  href="#scan-types"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Scan Types
                </a>
              </li>
              <li>
                <a
                  href="#how-it-works"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  How It Works
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">
              Coverage
            </h4>
            <ul className="space-y-2.5">
              <li>
                <span className="text-sm text-muted-foreground">
                  OWASP Top 10
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  Network Security
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  SSL/TLS Analysis
                </span>
              </li>
              <li>
                <span className="text-sm text-muted-foreground">
                  DNS Security
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-4">
              Account
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Create Account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <p className="text-[10px] text-muted-foreground/60 font-medium">
            &copy; {new Date().getFullYear()} VaultScan. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
