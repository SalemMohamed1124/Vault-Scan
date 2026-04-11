import { 
  ShieldCheck, 
  Brain, 
  Activity, 
  FileText, 
  BarChart3, 
  Globe, 
  Zap, 
  Search, 
  Server, 
  Eye, 
  Lock, 
  Bug, 
  Wifi 
} from "lucide-react";

export const features = [
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description:
      "Google Gemini AI analyzes vulnerabilities, prioritizes risks, and suggests actionable remediation steps tailored to your infrastructure.",
    gradient: "from-violet-500 to-purple-600",
    glow: "violet",
  },
  {
    icon: ShieldCheck,
    title: "20+ Security Checks",
    description:
      "Comprehensive scanning: SQL injection, XSS, CSRF, SSRF, IDOR, command injection, HTTP smuggling, and more.",
    gradient: "from-blue-500 to-cyan-500",
    glow: "blue",
  },
  {
    icon: Activity,
    title: "Real-time Progress",
    description:
      "Watch your scan unfold live with SSE-powered progress tracking. See findings as they're discovered, not just at the end.",
    gradient: "from-emerald-500 to-green-500",
    glow: "green",
  },
  {
    icon: BarChart3,
    title: "Security Scoring",
    description:
      "Get an instant security health score for your assets with trend analysis and severity breakdowns over time.",
    gradient: "from-amber-500 to-orange-500",
    glow: "amber",
  },
  {
    icon: Globe,
    title: "Multi-Tenant Platform",
    description:
      "Manage multiple organizations with role-based access control. Admins, editors, and viewers each see what they need.",
    gradient: "from-cyan-500 to-teal-500",
    glow: "cyan",
  },
  {
    icon: FileText,
    title: "Automated Reports",
    description:
      "Generate professional PDF and JSON reports with executive summaries, technical details, and compliance mappings.",
    gradient: "from-rose-500 to-pink-500",
    glow: "rose",
  },
];

export const scanTypes = [
  {
    icon: Zap,
    name: "Quick Scan",
    time: "~2 min",
    description:
      "Port scanning, HTTP headers, sensitive paths, SSL/TLS, and DNS checks.",
    checks: [
      "Port Scanning",
      "HTTP Security Headers",
      "Sensitive Paths",
      "SSL/TLS Analysis",
      "DNS Security",
    ],
  },
  {
    icon: Search,
    name: "Deep Scan",
    time: "~10 min",
    description:
      "Full OWASP Top 10 coverage with 20 specialized security scripts.",
    checks: [
      "SQL Injection",
      "XSS",
      "CSRF",
      "SSRF",
      "IDOR",
      "Command Injection",
      "SSTI",
      "XXE",
      "HTTP Smuggling",
      "Open Redirect",
      "LFI",
      "Subdomain Enumeration",
    ],
  },
];

export const stats = [
  { value: "20+", label: "Security Scripts" },
  { value: "15+", label: "Vulnerability Categories" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "<5min", label: "Quick Scan Time" },
];

export const steps = [
  {
    step: "01",
    title: "Add Your Assets",
    description:
      "Register your domains, IPs, URLs, or CIDR ranges. VaultScan validates and organizes them automatically.",
    icon: Server,
  },
  {
    step: "02",
    title: "Launch a Scan",
    description:
      "Choose Quick or Deep scan. Watch real-time progress as 20+ security scripts analyze your attack surface.",
    icon: Search,
  },
  {
    step: "03",
    title: "Review & Remediate",
    description:
      "Get AI-powered analysis with severity rankings, evidence, and step-by-step remediation guidance.",
    icon: Eye,
  },
];

export const categories = [
  { icon: Lock, name: "SQL Injection", severity: "Critical" },
  { icon: Bug, name: "Cross-Site Scripting", severity: "High" },
  { icon: ShieldCheck, name: "CSRF", severity: "Medium" },
  { icon: Wifi, name: "Port Scanning", severity: "Varies" },
  { icon: Globe, name: "DNS Security", severity: "Medium" },
  { icon: Server, name: "Misconfigurations", severity: "High" },
  { icon: Eye, name: "SSRF", severity: "Critical" },
  { icon: Lock, name: "SSL/TLS Analysis", severity: "Medium" },
];
