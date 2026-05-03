import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "dark" | "light" | "system";
type ColorPreset = "purple" | "blue" | "green" | "orange" | "rose" | "zinc" | "custom";
type FontPreset = "Reddit Mono" | "Inter" | "Space Grotesk" | "Fira Code" | "JetBrains Mono" | "Comic Neue";
type RadiusPreset = "none" | "default" | "md" | "lg" | "full";
export type EmojiPack = "native" | "twemoji" | "google" | "openmoji";
export type ThemePreset = "default" | "minecraft" | "win95" | "papyrus" | "hackernews" | "winxp" | "gameboy" | "nord" | "terminal";

/** Convert a hex color (#rrggbb) to an HSL string "H S% L%" suitable for CSS variables. */
function hexToHsl(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const colorPresets = {
    purple: { light: "270 30% 63%", dark: "270 40% 70%", glowL: "240 10% 3%", glowD: "270 50% 75%" },
    blue: { light: "220 70% 50%", dark: "220 75% 65%", glowL: "220 70% 50%", glowD: "220 75% 65%" },
    green: { light: "142 60% 45%", dark: "142 70% 50%", glowL: "142 60% 45%", glowD: "142 70% 50%" },
    orange: { light: "24 85% 55%", dark: "24 90% 65%", glowL: "24 85% 55%", glowD: "24 90% 65%" },
    rose: { light: "346 80% 60%", dark: "346 80% 65%", glowL: "346 80% 60%", glowD: "346 80% 65%" },
    zinc: { light: "240 5% 50%", dark: "240 5% 65%", glowL: "240 5% 50%", glowD: "240 5% 65%" },
};

const radiusPresets = {
    none: "0px",
    default: "3px",
    md: "8px",
    lg: "16px",
    full: "2rem",
};

const fontFamilies = {
    "Reddit Mono": "'Reddit Mono', monospace",
    "Inter": "'Inter', sans-serif",
    "Space Grotesk": "'Space Grotesk', sans-serif",
    "Fira Code": "'Fira Code', monospace",
    "JetBrains Mono": "'JetBrains Mono', monospace",
    "Comic Neue": "'Comic Neue', cursive",
};

type ThemeProviderProps = {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
};

type GridPreset = "blueprint" | "dotted" | "scanlines" | "none";

type ThemeProviderState = {
    theme: Theme;
    preset: ThemePreset;
    color: ColorPreset;
    customColor: string;
    font: FontPreset;
    grid: GridPreset;
    radius: RadiusPreset;
    emojiPack: EmojiPack;
    animateColor: boolean;
    cursorTrail: boolean;
    dataSaver: boolean;
    soundEnabled: boolean;
    shadowWalk: boolean;
    setTheme: (theme: Theme) => void;
    setPreset: (preset: ThemePreset) => void;
    setColor: (color: ColorPreset) => void;
    setCustomColor: (hex: string) => void;
    setFont: (font: FontPreset) => void;
    setGrid: (grid: GridPreset) => void;
    setRadius: (radius: RadiusPreset) => void;
    setEmojiPack: (emojiPack: EmojiPack) => void;
    setAnimateColor: (v: boolean) => void;
    setCursorTrail: (v: boolean) => void;
    setDataSaver: (v: boolean) => void;
    setSoundEnabled: (v: boolean) => void;
    setShadowWalk: (v: boolean) => void;
};

function safeGetItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

const initialState: ThemeProviderState = {
    theme: "system",
    preset: "default",
    color: "purple",
    customColor: "#8b5cf6",
    font: "Reddit Mono",
    grid: "blueprint",
    radius: "default",
    emojiPack: "twemoji",
    animateColor: false,
    cursorTrail: false,
    dataSaver: false,
    soundEnabled: false,
    shadowWalk: false,
    setTheme: () => null,
    setPreset: () => null,
    setColor: () => null,
    setCustomColor: () => null,
    setFont: () => null,
    setGrid: () => null,
    setRadius: () => null,
    setEmojiPack: () => null,
    setAnimateColor: () => null,
    setCursorTrail: () => null,
    setDataSaver: () => null,
    setSoundEnabled: () => null,
    setShadowWalk: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "genjutsu-appearance",
    ...props
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = safeGetItem(`${storageKey}-theme`);
        return (stored as Theme) || defaultTheme;
    });
    const [preset, setPresetState] = useState<ThemePreset>(() => {
        const stored = safeGetItem(`${storageKey}-preset`);
        if (stored === "minecraft" || stored === "win95" || stored === "papyrus" || stored === "hackernews" || stored === "winxp" || stored === "gameboy" || stored === "nord" || stored === "terminal") {
            return stored as ThemePreset;
        }
        return "default";
    });
    const [color, setColorState] = useState<ColorPreset>(() => {
        return (safeGetItem(`${storageKey}-color`) as ColorPreset) || "purple";
    });
    const [font, setFontState] = useState<FontPreset>(() => {
        const stored = safeGetItem(`${storageKey}-font`);
        if (stored && Object.prototype.hasOwnProperty.call(fontFamilies, stored)) {
            return stored as FontPreset;
        }
        return "Reddit Mono";
    });
    const [grid, setGridState] = useState<GridPreset>(() => {
        return (safeGetItem(`${storageKey}-grid`) as GridPreset) || "blueprint";
    });
    const [radius, setRadiusState] = useState<RadiusPreset>(() => {
        return (safeGetItem(`${storageKey}-radius`) as RadiusPreset) || "default";
    });
    const [emojiPack, setEmojiPackState] = useState<EmojiPack>(() => {
        const stored = safeGetItem(`${storageKey}-emojiPack`);
        if (stored === "native" || stored === "twemoji" || stored === "google" || stored === "openmoji") {
            return stored;
        }
        return "twemoji";
    });
    const [customColor, setCustomColorState] = useState<string>(() => {
        return safeGetItem(`${storageKey}-customColor`) || "#8b5cf6";
    });
    const [animateColor, setAnimateColorState] = useState<boolean>(() => {
        return safeGetItem(`${storageKey}-animateColor`) === "true";
    });
    const [cursorTrail, setCursorTrailState] = useState<boolean>(() => {
        return safeGetItem(`${storageKey}-cursorTrail`) === "true";
    });
    const [dataSaver, setDataSaverState] = useState<boolean>(() => {
        return safeGetItem(`${storageKey}-dataSaver`) === "true";
    });
    const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => {
        return safeGetItem(`${storageKey}-soundEnabled`) === "true";
    });
    const [shadowWalk, setShadowWalkState] = useState<boolean>(() => {
        return safeGetItem(`${storageKey}-shadowWalk`) === "true";
    });

    const hueRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);

    const setTheme = (val: Theme) => { safeSetItem(`${storageKey}-theme`, val); setThemeState(val); };
    const setPreset = (val: ThemePreset) => { safeSetItem(`${storageKey}-preset`, val); setPresetState(val); };
    const setColor = (val: ColorPreset) => { safeSetItem(`${storageKey}-color`, val); setColorState(val); };
    const setCustomColor = (hex: string) => { safeSetItem(`${storageKey}-customColor`, hex); setCustomColorState(hex); };
    const setFont = (val: FontPreset) => { safeSetItem(`${storageKey}-font`, val); setFontState(val); };
    const setGrid = (val: GridPreset) => { safeSetItem(`${storageKey}-grid`, val); setGridState(val); };
    const setRadius = (val: RadiusPreset) => { safeSetItem(`${storageKey}-radius`, val); setRadiusState(val); };
    const setEmojiPack = (val: EmojiPack) => { safeSetItem(`${storageKey}-emojiPack`, val); setEmojiPackState(val); };
    const setAnimateColor = (val: boolean) => { safeSetItem(`${storageKey}-animateColor`, String(val)); setAnimateColorState(val); };
    const setCursorTrail = (val: boolean) => { safeSetItem(`${storageKey}-cursorTrail`, String(val)); setCursorTrailState(val); };
    const setDataSaver = (val: boolean) => { safeSetItem(`${storageKey}-dataSaver`, String(val)); setDataSaverState(val); };
    const setSoundEnabled = (val: boolean) => { safeSetItem(`${storageKey}-soundEnabled`, String(val)); setSoundEnabledState(val); };
    const setShadowWalk = (val: boolean) => { safeSetItem(`${storageKey}-shadowWalk`, String(val)); setShadowWalkState(val); document.documentElement.setAttribute('data-shadow-walk', String(val)); };

    // Mode + static color + radius effect
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        let activeTheme = theme;
        if (theme === "system") {
            activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        root.classList.add(activeTheme);

        root.setAttribute("data-theme-preset", preset);
        root.setAttribute("data-grid", grid);
        root.setAttribute("data-emoji-pack", emojiPack);
        root.setAttribute("data-data-saver", String(dataSaver));
        root.setAttribute("data-shadow-walk", String(shadowWalk));

        // Only apply static color when animation is off
        if (!animateColor) {
            const rootStyles = document.documentElement.style;
            if (color === "custom") {
                const hsl = hexToHsl(customColor);
                rootStyles.setProperty('--primary', hsl);
                rootStyles.setProperty('--glow', hsl);
            } else {
                const preset = colorPresets[color] || colorPresets.purple;
                if (activeTheme === "dark") {
                    rootStyles.setProperty('--primary', preset.dark);
                    rootStyles.setProperty('--glow', preset.glowD);
                } else {
                    rootStyles.setProperty('--primary', preset.light);
                    rootStyles.setProperty('--glow', preset.glowL);
                }
            }
        }

        // Apply Radius
        document.documentElement.style.setProperty('--radius', radiusPresets[radius]);
    }, [theme, preset, color, customColor, radius, emojiPack, animateColor, grid, dataSaver, shadowWalk]);

    // Animated color loop — smooth 60fps hue cycling via requestAnimationFrame
    useEffect(() => {
        if (!animateColor) {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            return;
        }

        const tick = () => {
            // ~0.3°/frame → full rainbow ≈ 20s at 60fps
            hueRef.current = (hueRef.current + 0.3) % 360;
            const hsl = `${hueRef.current.toFixed(1)} 70% 65%`;
            document.documentElement.style.setProperty('--primary', hsl);
            document.documentElement.style.setProperty('--glow', hsl);
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [animateColor]);

    // Dynamic Font Injector Effect
    useEffect(() => {
        const rootStyles = document.documentElement.style;
        rootStyles.setProperty('--font-sans', fontFamilies[font]);
        rootStyles.setProperty('--font-mono', fontFamilies[font]);

        if (font !== "Reddit Mono") {
            const fontName = font.replace(/ /g, "+");
            const linkId = `dynamic-font-${fontName}`;
            if (!document.getElementById(linkId)) {
                const link = document.createElement("link");
                link.id = linkId;
                link.rel = "stylesheet";
                link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@300;400;500;600;700&display=swap`;
                document.head.appendChild(link);
            }
        }
    }, [font]);

    const value = {
        theme, preset, color, customColor, font, grid, radius, emojiPack, animateColor, cursorTrail, dataSaver, soundEnabled, shadowWalk,
        setTheme, setPreset, setColor, setCustomColor, setFont, setGrid, setRadius, setEmojiPack, setAnimateColor, setCursorTrail, setDataSaver, setSoundEnabled, setShadowWalk
    };

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);
    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");
    return context;
};
