import { useEffect, useMemo, useState, type ImgHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { ImageOff } from "lucide-react";
import { cn, getSafeUrl } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

type DataSaverImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  allowAutoLoad?: boolean;
};

const isRemoteImageSrc = (src?: string) => {
  if (!src) return false;
  return /^https?:\/\//i.test(src) || src.startsWith("//");
};

export default function DataSaverImage({
  src,
  alt,
  className,
  allowAutoLoad = false,
  ...props
}: DataSaverImageProps) {
  const { dataSaver } = useTheme();

  const shouldGate = useMemo(
    () => dataSaver && !allowAutoLoad && isRemoteImageSrc(src),
    [allowAutoLoad, dataSaver, src]
  );

  const [isUnlocked, setIsUnlocked] = useState(!shouldGate);

  useEffect(() => {
    setIsUnlocked(!shouldGate);
  }, [shouldGate, src]);

  if (!src) return null;

  if (!shouldGate || isUnlocked) {
    return <img src={getSafeUrl(src)} alt={alt} className={className} {...props} />;
  }

  const unlock = (event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsUnlocked(true);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={unlock}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          unlock(event);
        }
      }}
      aria-label={alt ? `Load ${alt}` : "Load image"}
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden bg-secondary text-muted-foreground border border-border/60 cursor-pointer",
        className
      )}
    >
      <span className="absolute inset-0 bg-gradient-to-br from-secondary/80 to-background/60" />
      <span className="relative z-10 flex flex-col items-center gap-2 px-3 py-2 text-center">
        <ImageOff size={16} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Load Image</span>
      </span>
    </div>
  );
}
