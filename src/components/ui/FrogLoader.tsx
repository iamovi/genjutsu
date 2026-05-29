import { cn } from "@/lib/utils";

export const APP_LOADER_SIZE = 32;

export const FrogLoader = ({ size = 24, className }: { size?: number, className?: string }) => {
  // Frogs need to be bigger than generic line-art spinners to be visible.
  // We double the visual size, but contain it in a relative wrapper of the original size
  // so that it visually overflows without breaking layout or stretching buttons.
  const visualSize = Math.max(size * 1.75, 28); // minimum 28px visual size

  return (
    <span 
      className={cn("relative inline-flex items-center justify-center shrink-0", className)} 
      style={{ width: size, height: size }}
    >
      <img 
        src="/frog-loader.gif" 
        alt="Loading..." 
        width={visualSize} 
        height={visualSize} 
        className="absolute object-contain mix-blend-multiply dark:mix-blend-lighten max-w-none pointer-events-none" 
      />
    </span>
  );
};

export const FullScreenFrogLoader = ({ className }: { className?: string }) => (
  <div className={cn("min-h-screen bg-background flex items-center justify-center", className)}>
    <FrogLoader size={APP_LOADER_SIZE} />
  </div>
);
