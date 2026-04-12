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
    <main className="relative min-h-screen w-full  text-foreground">
      <div className="inset-0 z-0 pointer-events-none">
        <LandingBackground />
      </div>
      <div className="relative z-10 w-full">
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
