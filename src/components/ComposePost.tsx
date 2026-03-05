import { useState, useEffect, useRef } from "react";
import { Code, ImageIcon, Smile, Send, X, Loader2 } from "lucide-react";
import { useMentions } from "@/hooks/useMentions";
import { motion, AnimatePresence } from "framer-motion";
import MentionList from "./MentionList";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import { FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ComposePostProps {
  onPost: (content: string, code: string, tags: string[], media_url?: string, is_readme?: boolean) => Promise<void>;
}

const ComposePost = ({ onPost }: ComposePostProps) => {
  const [content, setContent] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [isReadme, setIsReadme] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useProfile();
  const { user } = useAuth();

  // Mention state
  const { suggestions, fetchSuggestions, clearSuggestions } = useMentions();
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);

  // Auto-expand textarea with limit
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 400); // Max height of 400px
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > 400 ? "auto" : "hidden";
    }
  }, [content]);

  const extractTags = (text: string): string[] => {
    // Unicode-aware regex to match hashtags in any language
    const matches = text.match(/#([\p{L}\p{N}_]+)/gu);
    return matches ? matches.map((t) => t.slice(1).toLowerCase()) : [];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("That's a heavy memory! Please keep images under 5MB.");
        return;
      }
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const uploadMedia = async (): Promise<string | null> => {
    if (!mediaFile) return null;

    try {
      const fileExt = mediaFile.name.split(".").pop();
      const filePath = `${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(filePath, mediaFile);

      if (uploadError) {
        // If bucket doesn't exist, this might fail. We should ideally check first.
        throw uploadError;
      }

      const { data } = supabase.storage.from("post-media").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("We couldn't manifest your image. Please try again.");
      return null;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionSearch(query);
      setMentionIndex(cursorPosition - query.length - 1);
      fetchSuggestions(query);
    } else {
      setMentionSearch("");
      clearSuggestions();
    }
  };

  const insertMention = (username: string) => {
    if (mentionIndex === -1) return;

    const before = content.substring(0, mentionIndex);
    const after = content.substring(mentionIndex + mentionSearch.length + 1);
    const newText = `${before}@${username} ${after}`;

    setContent(newText);
    setMentionSearch("");
    clearSuggestions();

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    try {
      let mediaUrl = "";
      if (mediaFile) {
        const uploadedUrl = await uploadMedia();
        if (uploadedUrl) mediaUrl = uploadedUrl;
      }

      const tags = extractTags(content);
      // Clean content only for normal posts to remove extracted hashtags and collapse spaces
      const postContent = isReadme
        ? content
        : content.replace(/#[\p{L}\p{N}_]+/gu, "").replace(/\s+/g, " ").trim();

      await onPost(postContent || content, code, tags, mediaUrl, isReadme);

      setContent("");
      setCode("");
      setIsReadme(false);
      setShowPreview(false);
      if (mediaPreview) URL.revokeObjectURL(mediaPreview);
      setMediaPreview(null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="gum-card p-5 mb-6"
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
          ) : initials}
        </div>
        <div className="flex-1 min-w-0 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            placeholder="Share what you're building... (use #tags or @mentions)"
            className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground min-h-[60px] custom-scrollbar"
            rows={2}
          />

          {isReadme && showPreview && (
            <div className="mt-3 p-4 rounded-lg gum-border bg-secondary/10 max-h-[400px] overflow-y-auto prose-readme custom-scrollbar">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkGemoji]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md my-4"
                        {...props}
                      >
                        {String(children).replace(/\n$/, "")}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

          <MentionList
            suggestions={suggestions}
            onSelect={insertMention}
            containerRef={textareaRef}
          />

          <AnimatePresence>
            {mediaPreview && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative mt-3 rounded-lg gum-border overflow-hidden max-h-[300px]"
              >
                <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                  className="absolute top-2 right-2 p-1 bg-background/80 hover:bg-background rounded-full gum-border transition-colors"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {showCode && (
            <div className="mt-3">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="// Paste your code here..."
                className="w-full bg-muted text-foreground font-mono text-xs p-3 rounded-lg gum-border resize-none outline-none min-h-[120px]"
                rows={4}
              />
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-secondary">
            <div className="flex items-center gap-1">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                title="Upload Image"
              >
                <ImageIcon size={16} />
              </button>
              <button
                onClick={() => setShowCode(!showCode)}
                className={`p-2 rounded-lg transition-colors ${showCode ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                  }`}
                title="Add Code"
              >
                <Code size={16} />
              </button>
              <button
                onClick={() => setIsReadme(!isReadme)}
                className={`p-2 rounded-lg transition-colors ${isReadme ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"
                  }`}
                title="Toggle README (Markdown)"
              >
                <FileText size={16} />
              </button>
              {isReadme && (
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-[3px] gum-border uppercase tracking-tight transition-colors ${showPreview ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                    }`}
                >
                  {showPreview ? "Editor" : "Preview"}
                </button>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="gum-btn bg-primary text-primary-foreground text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {submitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ComposePost;
