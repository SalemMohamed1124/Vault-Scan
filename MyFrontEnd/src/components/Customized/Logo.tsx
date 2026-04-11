
function Logo() {
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <div className="flex h-8 w-8 items-center justify-center bg-primary">
        <span className="font-mono text-base font-bold text-background uppercase tracking-tighter">V</span>
      </div>
      <span className="font-mono text-[13px] font-semibold tracking-widest text-foreground uppercase antialiased">
        V.SCANNER
      </span>
    </div>
  );
}
export default Logo;
