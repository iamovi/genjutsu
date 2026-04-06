import { useEffect } from "react";
import { useTheme } from "./theme-provider";

export const ShadowWalkEngine = () => {
    const { shadowWalk, setShadowWalk } = useTheme();

    // Global keyboard shortcut: Ctrl+Shift+S
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "S") {
                e.preventDefault();
                setShadowWalk(!shadowWalk);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shadowWalk, setShadowWalk]);

    if (!shadowWalk) return null;

    // Floating ninja indicator in bottom-left corner
    return (
        <div
            className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2 bg-black/80 text-white px-3 py-2 rounded-[3px] text-xs font-bold tracking-widest uppercase select-none pointer-events-none"
            style={{ backdropFilter: "blur(8px)" }}
        >
            <span className="text-base animate-pulse">🥷</span>
            <span className="opacity-70">Shadow Walk</span>
        </div>
    );
};
