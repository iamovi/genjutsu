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

    setIsDownloading(true);
    const filename = getDownloadFilename(src);

    try {
      const response = await fetch(src);
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
      a.href = src;
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
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex flex-col items-center justify-center outline-none">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <DialogDescription className="sr-only">Full size view of the image</DialogDescription>

        <div className="relative flex flex-col items-center max-w-full max-h-full">
          {/* Main Image */}
          <div className="relative group max-w-full max-h-[85vh] overflow-hidden flex items-center justify-center">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[85vh] rounded-[3px] gum-border gum-shadow object-contain bg-background/5"
            />
          </div>

          {/* Controls Bar at bottom */}
          <div className="mt-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={cn(
                "gum-btn h-11 px-6 flex items-center gap-2 bg-background/90 backdrop-blur-md text-foreground border-2 border-foreground hover:bg-primary hover:text-primary-foreground transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_white]",
                isDownloading && "opacity-70 cursor-not-allowed"
              )}
            >
              {isDownloading ? (
                <FrogLoader size={18} className="animate-spin" />
              ) : (
                <Download size={18} strokeWidth={2.5} />
              )}
              <span className="font-bold uppercase tracking-tight text-xs">Download</span>
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="gum-btn h-11 px-6 flex items-center gap-2 bg-background/90 backdrop-blur-md text-foreground border-2 border-foreground hover:bg-secondary transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_white]"
            >
              <X size={18} strokeWidth={2.5} />
              <span className="font-bold uppercase tracking-tight text-xs">Close</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
