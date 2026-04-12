export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
