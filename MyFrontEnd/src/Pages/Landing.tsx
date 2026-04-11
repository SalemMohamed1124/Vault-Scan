import { Shield, Search, Bell, BarChart3, Users, Lock, Zap, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

interface LandingPageProps {
  onLogin?: () => void;
  onRegister?: () => void;
}

const FEATURES = [
  {
    icon: Search,
    title: "Attack Surface Discovery",
    description: "Automatically discover and monitor all your domains, IPs, and ports across your infrastructure.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: Shield,
    title: "Vulnerability Detection",
    description: "Identify security vulnerabilities with continuous scanning and get actionable insights.",
    color: "bg-purple-100 text-purple-600",
  },
  {
    icon: Bell,
    title: "Real-time Alerts",
    description: "Get instant notifications when new vulnerabilities are discovered or threats detected.",
    color: "bg-green-100 text-green-600",
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Visualize your security posture with comprehensive dashboards and detailed reports.",
    color: "bg-orange-100 text-orange-600",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Manage multiple organizations with role-based access control for your security team.",
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    icon: Zap,
    title: "Automated Scanning",
    description: "Schedule recurring scans and let our platform continuously monitor your assets.",
    color: "bg-red-100 text-red-600",
  },
];

const STATS = [
  { label: "Assets Monitored", value: "10K+" },
  { label: "Organizations", value: "500+" },
  { label: "Uptime", value: "99.9%" },
  { label: "Monitoring", value: "24/7" },
];

const TRUST_REASONS = [
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Bank-level encryption and compliance with industry standards",
  },
  {
    icon: Globe,
    title: "Global Coverage",
    description: "Scan assets anywhere in the world with our distributed infrastructure",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Get results in minutes, not hours or days",
  },
];

export default function Landing({ onLogin, onRegister }: LandingPageProps) {
  const navigate = useNavigate();

  const handleLogin = onLogin || (() => navigate("/login"));
  const handleRegister = onRegister || (() => navigate("/register"));

  return (
    <div className="min-h-screen bg-white font-sans antialiased text-slate-900">
      <Navbar onLogin={handleLogin} onRegister={handleRegister} />

      <main>
        <Hero onLogin={handleLogin} onRegister={handleRegister} />
        <Features />
        <Screenshot />
        <Stats />
        <Trust />
        <CTA onLogin={handleLogin} onRegister={handleRegister} />
      </main>

      <Footer />
    </div>
  );
}

const Navbar = ({ onLogin, onRegister }: LandingPageProps) => (
  <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <Logo />
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onLogin}>
          Login
        </Button>
        <Button onClick={onRegister}>Get Started</Button>
      </div>
    </div>
  </header>
);

const Logo = ({ size = "size-8" }: { size?: string }) => (
  <div className="flex items-center gap-2">
    <Shield className={`${size} text-blue-600`} />
    <span className="text-2xl font-bold tracking-tight">SecureScan</span>
  </div>
);

const Hero = ({ onLogin, onRegister }: LandingPageProps) => (
  <section className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          Comprehensive Vulnerability Scanning for Your Digital Assets
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-lg">
          Monitor your attack surface, identify vulnerabilities, and secure your infrastructure with real-time scanning and
          alerts.
        </p>
        <div className="flex flex-wrap gap-4">
          <Button size="lg" className="px-8" onClick={onRegister}>
            Start Free Trial
          </Button>
          <Button size="lg" variant="outline" className="px-8" onClick={onLogin}>
            Sign In
          </Button>
        </div>
      </div>
      <div className="relative group">
        <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-indigo-600 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <img
          src="https://images.unsplash.com/photo-1639503547276-90230c4a4198?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Cybersecurity"
          className="relative rounded-lg shadow-2xl w-full object-cover aspect-video lg:aspect-square"
        />
      </div>
    </div>
  </section>
);

const Features = () => (
  <section className="bg-slate-50 py-24">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-4xl font-bold mb-4">Everything You Need to Secure Your Infrastructure</h2>
        <p className="text-xl text-slate-600">Powerful features designed for security teams and organizations</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {FEATURES.map((feature, idx) => (
          <FeatureCard key={idx} {...feature} />
        ))}
      </div>
    </div>
  </section>
);

const FeatureCard = ({ icon: Icon, title, description, color }: (typeof FEATURES)[0]) => (
  <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
    <div className={`size-12 rounded-xl flex items-center justify-center mb-6 ${color}`}>
      <Icon className="size-6" />
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-slate-600 leading-relaxed">{description}</p>
  </div>
);

const Screenshot = () => (
  <section className="py-24 overflow-hidden">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-bold mb-4">Monitor Your Security Posture</h2>
        <p className="text-xl text-slate-600">Real-time visibility into your entire attack surface</p>
      </div>
      <div className="relative mx-auto max-w-5xl">
        <div className="absolute -inset-4 bg-linear-to-tr from-blue-500/10 to-indigo-500/10 blur-3xl rounded-[3rem]"></div>
        <img
          src="https://images.unsplash.com/photo-1765121689322-6befc57dc8db?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
          alt="Security monitoring dashboard"
          className="relative rounded-xl shadow-2xl border border-slate-200"
        />
      </div>
    </div>
  </section>
);

const Stats = () => (
  <section className="bg-blue-600 text-white py-20 relative overflow-hidden">
    <div className="absolute inset-0 bg-grid-white/[0.05] bg-size-[20px_20px]"></div>
    <div className="max-w-7xl mx-auto px-6 relative">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {STATS.map((stat, idx) => (
          <div key={idx}>
            <div className="text-4xl lg:text-5xl font-extrabold mb-2">{stat.value}</div>
            <div className="text-blue-100 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const Trust = () => (
  <section className="py-24">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid lg:grid-cols-2 gap-16 items-center">
        <div className="order-2 lg:order-1">
          <img
            src="https://images.unsplash.com/photo-1724204401208-6349fc373543?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="Data protection"
            className="rounded-2xl shadow-xl border border-slate-100"
          />
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="text-4xl font-bold mb-6">Trusted by Security Teams Worldwide</h2>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            SecureScan provides enterprise-grade security scanning with the flexibility and ease of use that modern teams need.
          </p>
          <div className="space-y-8">
            {TRUST_REASONS.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4">
                <div className="mt-1 bg-blue-50 p-2 rounded-lg">
                  <item.icon className="size-6 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1">{item.title}</h4>
                  <p className="text-slate-600 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

const CTA = ({ onLogin, onRegister }: LandingPageProps) => (
  <section className="bg-slate-900 text-white py-24">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <h2 className="text-4xl font-bold mb-6">Ready to Secure Your Infrastructure?</h2>
      <p className="text-xl text-slate-300 mb-10">
        Join hundreds of organizations using SecureScan to protect their digital assets.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8" onClick={onRegister}>
          Start Free Trial
        </Button>
        <Button size="lg" variant="outline" className="border-slate-700 text-white hover:bg-slate-800 px-8" onClick={onLogin}>
          Sign In
        </Button>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="border-t border-slate-100 py-12 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <Logo size="size-6" />
        <p className="text-slate-500 text-sm">© {new Date().getFullYear()} SecureScan. All rights reserved.</p>
      </div>
    </div>
  </footer>
);
