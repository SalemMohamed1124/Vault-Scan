export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background">
      {/* Background effects (dark mode only) */}
      <div className="pointer-events-none absolute inset-0 hidden dark:block">
        <div className="vault-bg-mesh absolute inset-0" />
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/6 blur-[150px]" />
        <div className="absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full bg-blue-500/4 blur-[150px]" />
      </div>

      {/* Light mode subtle pattern */}
      <div className="pointer-events-none absolute inset-0 dark:hidden">
        <div className="absolute -top-40 left-1/3 h-[500px] w-[500px] rounded-full bg-primary/4 blur-[150px]" />
        <div className="absolute -bottom-20 right-1/3 h-[400px] w-[400px] rounded-full bg-blue-500/3 blur-[150px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full px-4">{children}</div>
    </div>
  );
}
