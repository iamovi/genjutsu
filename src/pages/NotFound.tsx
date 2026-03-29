import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, UserCircle } from "lucide-react";

const NotFound = () => {
    const location = useLocation();

    useEffect(() => {
        console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="gum-card p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                    <h1 className="text-8xl font-black tracking-tighter mb-2 italic">404</h1>
                    <div className="space-y-2">
                        <p className="text-xl font-bold uppercase tracking-widest">Illusion Lost</p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            The page you are looking for has vanished into the genjutsu. It may have moved or never existed.
                        </p>
                    </div>

                    <div className="mt-8 p-4 bg-secondary/50 rounded-[3px] border-2 border-dashed border-primary/20 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                            <UserCircle size={16} />
                            Looking for a profile?
                        </div>
                        <p className="text-xs text-muted-foreground">
                            User profiles now live at <span className="font-mono text-foreground font-bold bg-background px-1.5 py-0.5 rounded-sm">/u/username</span>
                        </p>
                    </div>

                    <div className="pt-8">
                        <Link
                            to="/"
                            className="gum-btn inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground font-bold hover:scale-105 active:scale-95 transition-all"
                        >
                            <ArrowLeft size={18} />
                            Escape to Home
                        </Link>
                    </div>
                </div>

                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
                    © 2026 GENJUTSU — ECHOES OF THE VOID
                </p>
            </div>
        </div>
    );
};

export default NotFound;
