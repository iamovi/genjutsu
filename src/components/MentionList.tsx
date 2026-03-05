import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Profile {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
}

interface MentionListProps {
    suggestions: Profile[];
    onSelect: (username: string) => void;
    containerRef?: React.RefObject<HTMLElement>;
}

const MentionList = ({ suggestions, onSelect, containerRef }: MentionListProps) => {
    const [position, setPosition] = useState<"top" | "bottom">("top");
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updatePosition = () => {
            if (containerRef?.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const spaceAbove = rect.top;
                const spaceBelow = window.innerHeight - rect.bottom;

                // If space above is less than 250px and there's more space below, show at bottom
                if (spaceAbove < 250 && spaceBelow > spaceAbove) {
                    setPosition("bottom");
                } else {
                    setPosition("top");
                }
            }
        };

        updatePosition();
        window.addEventListener("scroll", updatePosition, { passive: true });
        window.addEventListener("resize", updatePosition);

        return () => {
            window.removeEventListener("scroll", updatePosition);
            window.removeEventListener("resize", updatePosition);
        };
    }, [containerRef, suggestions]);

    if (suggestions.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                ref={listRef}
                initial={{ opacity: 0, y: position === "top" ? 10 : -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: position === "top" ? 10 : -10 }}
                className={`absolute ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"
                    } left-0 w-64 gum-card bg-background/95 backdrop-blur-sm shadow-xl z-50 overflow-hidden border border-primary/20`}
            >
                <div className="p-2 border-b border-secondary bg-secondary/30">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Mention User
                    </span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                    {suggestions.map((profile) => (
                        <button
                            key={profile.id}
                            type="button"
                            onClick={() => onSelect(profile.username)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-primary hover:text-primary-foreground transition-all group border-b border-secondary/10 last:border-0 text-left"
                        >
                            <div className="w-10 h-10 rounded-[3px] gum-border bg-secondary overflow-hidden shrink-0 group-hover:border-primary-foreground/30">
                                {profile.avatar_url ? (
                                    <img
                                        src={profile.avatar_url}
                                        alt={profile.username}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center font-bold text-sm uppercase">
                                        {profile.display_name?.[0] || "?"}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm truncate leading-none">
                                    {profile.display_name}
                                </p>
                                <p className="text-xs opacity-70 truncate mt-1">
                                    @{profile.username}
                                </p>
                            </div>
                        </button>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default MentionList;
