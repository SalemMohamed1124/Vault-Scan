import { cookies } from "next/headers";
import { LandingNavbar } from "@/Features/landing/LandingNavbar";
import { LandingHero } from "@/Features/landing/LandingHero";
import { LandingFeatures } from "@/Features/landing/LandingFeatures";
import { LandingHowItWorks } from "@/Features/landing/LandingHowItWorks";
import { LandingScanTypes } from "@/Features/landing/LandingScanTypes";
import { LandingCategories } from "@/Features/landing/LandingCategories";
import { LandingCTA } from "@/Features/landing/LandingCTA";
import { LandingFooter } from "@/Features/landing/LandingFooter";
import { LandingBackground } from "@/Features/landing/LandingBackground";

export default async function HomePage() {
  const cookieStore = await cookies();
  const authed = !!cookieStore.get("access_token")?.value;

  return (
    <main className="relative min-h-screen bg-background text-foreground selection:bg-primary/20">
      <LandingBackground />
      <div className="relative z-10">
        <LandingNavbar authed={authed} />
        <LandingHero />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingScanTypes />
        <LandingCategories />
        <LandingCTA />
        <LandingFooter />
      </div>
    </main>
  );
}
