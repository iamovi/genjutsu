import { useEffect, useMemo, useRef, useState } from "react";
import { Code, FileText, ImageIcon, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { PostWithProfile } from "@/hooks/usePosts";
import { usePostActions } from "@/hooks/usePostActions";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostWithProfile;
  onEdited?: (updated: {
    content: string;
    code: string;
    code_language: string | null;
    media_url: string | null;
    is_readme: boolean;
    tags: string[];
    edited_at: string | null;
  }) => void;
}

const LANGUAGE_OPTIONS = [
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "json",
  "bash",
  "rust",
  "go",
  "cpp",
  "java",
  "sql",
  "markdown",
  "text",
];

function extractTags(text: string): string[] {
  const matches = text.match(/#([\p{L}\p{N}_]+)/gu);
  return matches ? matches.map((tag) => tag.slice(1).toLowerCase()) : [];
}

function cleanPostContent(content: string, isReadme: boolean): string {
  if (isReadme) return content;
  return content.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();
}

export default function EditPostDialog({ open, onOpenChange, post, onEdited }: EditPostDialogProps) {
  const { editPost } = usePostActions();

  const [content, setContent] = useState(post.content);
  const [isReadme, setIsReadme] = useState(post.is_readme);
  const [showCode, setShowCode] = useState(!!post.code);
  const [code, setCode] = useState(post.code || "");
  const [codeLanguage, setCodeLanguage] = useState(post.code_language || "javascript");
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const oldMediaUrl = post.media_url || "";
  const hasExistingMedia = !!oldMediaUrl;

  useEffect(() => {
    if (!open) return;
    setContent(post.content);
    setIsReadme(post.is_readme);
    setCode(post.code || "");
    setShowCode(!!(post.code && post.code.trim()));
    setCodeLanguage(post.code_language || "javascript");
    setRemoveExistingMedia(false);

    setMediaPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setMediaFile(null);
  }, [open, post]);

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const currentMediaPreview = useMemo(() => {
    if (mediaPreview) return mediaPreview;
    if (!removeExistingMedia && hasExistingMedia) return oldMediaUrl;
    return "";
  }, [mediaPreview, removeExistingMedia, hasExistingMedia, oldMediaUrl]);

  const handleFiles = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("That's a heavy memory! Please keep images under 5MB.");
      return;
    }

    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
    setRemoveExistingMedia(false);
  };

  const uploadPostMedia = async (file: File): Promise<{ publicUrl: string; storagePath: string } | null> => {
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${Math.random()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("post-media")
      .upload(filePath, file);

    if (uploadError) return null;

    const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);
    return { publicUrl: data.publicUrl, storagePath: filePath };
  };

  const rollbackUploadedMedia = async (storagePath: string | null) => {
    if (!storagePath) return;
    await supabase.storage.from("post-media").remove([storagePath]);
  };

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    let uploadedPath: string | null = null;
    try {
      let finalMediaUrl = oldMediaUrl;

      if (mediaFile) {
        const uploadResult = await uploadPostMedia(mediaFile);
        if (!uploadResult) {
          toast.error("We couldn't manifest your image. Please try again.");
          return;
        }
        finalMediaUrl = uploadResult.publicUrl;
        uploadedPath = uploadResult.storagePath;
      } else if (removeExistingMedia) {
        finalMediaUrl = "";
      }

      const tags = extractTags(content);
      const normalizedContent = cleanPostContent(content, isReadme);
      const finalContent = normalizedContent || content;
      const finalCode = showCode ? code : "";
      const finalCodeLanguage = showCode ? codeLanguage : null;

      const result = await editPost({
        postId: post.id,
        content: finalContent,
        code: finalCode,
        codeLanguage: finalCodeLanguage,
        tags,
        mediaUrl: finalMediaUrl,
        isReadme,
        oldMediaUrl,
      });

      if (!result) return;

      onEdited?.({
        content: finalContent,
        code: finalCode,
        code_language: finalCodeLanguage,
        media_url: finalMediaUrl || null,
        is_readme: isReadme,
        tags,
        edited_at: result.editedAt,
      });

      onOpenChange(false);
    } catch {
      await rollbackUploadedMedia(uploadedPath);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6 pr-12">
          <DialogTitle>Edit Post</DialogTitle>
          <DialogDescription>Update your post details before it expires.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What are you building?"
            className="w-full bg-secondary/40 gum-border p-3 resize-none outline-none text-sm min-h-[120px]"
          />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCode((prev) => !prev)}
              className={`p-2 rounded-[3px] transition-colors ${showCode ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                }`}
              title="Toggle code"
            >
              <Code size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsReadme((prev) => !prev)}
              className={`p-2 rounded-[3px] transition-colors ${isReadme ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                }`}
              title="Toggle README mode"
            >
              <FileText size={16} />
            </button>
          </div>

          {showCode && (
            <div className="space-y-2">
              <select
                value={codeLanguage}
                onChange={(e) => setCodeLanguage(e.target.value)}
                className="bg-secondary text-secondary-foreground text-xs rounded-[3px] px-2 py-1 outline-none border border-border cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste your code here..."
                className="w-full bg-muted text-foreground font-mono text-xs p-3 rounded-[3px] gum-border resize-none outline-none min-h-[120px]"
              />
            </div>
          )}

          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files?.[0] || null)}
              accept="image/*"
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 gum-btn bg-secondary text-secondary-foreground text-xs"
              >
                <ImageIcon size={14} />
                {hasExistingMedia || mediaFile ? "Replace image" : "Add image"}
              </button>

              {(hasExistingMedia || mediaFile) && (
                <button
                  type="button"
                  onClick={() => {
                    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
                    setMediaPreview(null);
                    setMediaFile(null);
                    setRemoveExistingMedia((prev) => !prev);
                  }}
                  className="inline-flex w-full sm:w-auto justify-center items-center gap-2 gum-btn bg-secondary text-secondary-foreground text-xs"
                >
                  <RotateCcw size={14} />
                  {removeExistingMedia ? "Undo remove" : "Remove image"}
                </button>
              )}
            </div>

            {currentMediaPreview ? (
              <div className="relative rounded-[3px] gum-border overflow-hidden max-h-[280px]">
                <img src={currentMediaPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
                    setMediaPreview(null);
                    setMediaFile(null);
                    setRemoveExistingMedia(true);
                  }}
                  className="absolute top-2 right-2 p-1 bg-background/80 hover:bg-background rounded-full gum-border transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-4 py-3 sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="gum-btn bg-secondary text-secondary-foreground text-sm w-full sm:w-auto"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!content.trim() || submitting}
            className="gum-btn bg-primary text-primary-foreground text-sm disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {submitting ? <FrogLoader size={14} /> : "Save changes"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
