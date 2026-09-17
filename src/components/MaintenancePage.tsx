export function MaintenancePage() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <span className="text-5xl">✨</span>
        <h1 className="text-2xl font-bold tracking-tight">Genjutsu is Reactivating Soon!</h1>
        <p className="text-muted-foreground text-base max-w-md">
          We are upgrading and rebranding with a new name: <span className="font-semibold text-foreground">Nychthemeron</span>.
        </p>
        <p className="text-muted-foreground text-xs">
          Thank you for being here always — stay tuned for what's coming next! 💜
        </p>
      </div>
    </div>
  );
}
