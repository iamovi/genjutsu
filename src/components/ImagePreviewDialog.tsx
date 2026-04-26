import { useState } from "react";
import { Download, X } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ImagePreviewDialogProps {
  src: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  alt?: string;
}

export function ImagePreviewDialog({
  src,
  isOpen,
  onOpenChange,
  alt = "Image preview",
}: ImagePreviewDialogProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const normalizeSafeHttpUrl = (urlValue: string): string | null => {
    try {
      const parsed = new URL(urlValue, window.location.href);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const getDownloadFilename = (imageUrl: string) => {
    try {
      const cleanUrl = imageUrl.split("?")[0].split("#")[0];
      const raw = cleanUrl.split("/").pop() || "genjutsu-image";
      const safe = raw.replace(/[^a-zA-Z0-9._-]/g, "_");
      return safe || "genjutsu-image";
    } catch {
      return "genjutsu-image";
    }
  };

  const handleDownload = async () => {
    if (!src || isDownloading) return;

    const safeUrl = normalizeSafeHttpUrl(src);
    if (!safeUrl) {
      toast.error("Unsupported image URL.");
      return;
    }

    setIsDownloading(true);
    const filename = getDownloadFilename(safeUrl);

    try {
      const response = await fetch(safeUrl);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(blobUrl);
      toast.success("Image downloaded.");
    } catch (error) {
      console.error("Download error:", error);
      // Fallback: open the file source so users can still save it manually.
      const a = document.createElement("a");
      a.href = safeUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      toast.info("Opened image in new tab. Save it from there if auto-download is blocked.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!src) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none p-0 border-none bg-black/95 shadow-none outline-none overflow-hidden [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <DialogDescription className="sr-only">Full size view of the image</DialogDescription>

        <div
          className="relative w-full h-full overflow-hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3 sm:p-4">
            <button
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70 transition-colors"
              aria-label="Close image preview"
            >
              <X size={20} />
            </button>

            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70 transition-colors",
                isDownloading && "opacity-70 cursor-not-allowed"
              )}
              aria-label="Download image"
            >
              {isDownloading ? <FrogLoader size={16} className="animate-spin" /> : <Download size={18} />}
            </button>
          </div>

          <div className="absolute inset-0 pt-14 sm:pt-16 pb-4 px-4 sm:px-8 flex items-center justify-center min-h-0 min-w-0">
            <img
              src={src}
              alt={alt}
              className="w-auto h-auto max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
