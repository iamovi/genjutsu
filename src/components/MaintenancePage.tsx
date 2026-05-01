export function MaintenancePage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <span className="text-5xl">:(</span>
        <h1 className="text-2xl font-bold tracking-tight">Genjutsu is temporarily unavailable</h1>
        <p className="text-muted-foreground text-sm">Backend is restarting</p>
        <p className="text-muted-foreground text-xs">see you again in 10 - 15 minutes! 💜</p>
      </div>
    </div>
  );
}
