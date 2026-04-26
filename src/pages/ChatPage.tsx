import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWhispers, Whisper } from "@/hooks/useWhispers";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Send, ImageIcon, X } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Helmet } from "react-helmet-async";
import { linkify } from "@/lib/linkify";
import WhisperLinkPreview from "@/components/WhisperLinkPreview";
import { ImagePreviewDialog } from "@/components/ImagePreviewDialog";

const ChatPage = () => {
    const { username } = useParams<{ username: string }>();
    const [targetProfile, setTargetProfile] = useState<{ user_id: string; display_name: string; avatar_url: string | null; username: string } | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [messageText, setMessageText] = useState("");
    const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
    const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState<string | null>(null);
    const [activeLightboxImageUrl, setActiveLightboxImageUrl] = useState<string | null>(null);
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const dragDepthRef = useRef(0);

    // Fetch target profile first
    useEffect(() => {
        const fetchProfile = async () => {
            if (!username) return;
            try {
                setLoadingProfile(true);
                const { data, error } = await supabase
                    .from("profiles")
                    .select("user_id, display_name, avatar_url, username")
                    .eq("username", username.toLowerCase())
                    .single();

                if (error) throw error;
                if (!data) throw new Error("User not found");
                if (user && data.user_id === user.id) {
                    toast.error("You can't whisper to yourself!");
                    navigate("/whispers");
                    return;
                }
                setTargetProfile(data);
            } catch (err: any) {
                console.error("Profile load error:", err);
                toast.error("Character not found in the abyss");
                navigate("/whispers");
            } finally {
                setLoadingProfile(false);
            }
        };
        fetchProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username, navigate]);

    const { messages, loadingMessages, sendMessage, isSending, setTyping, isOtherUserTyping } = useWhispers(targetProfile?.user_id);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOtherUserTyping]);

    useEffect(() => {
        // Mobile browsers can keep accidental tap-selection during route transitions.
        // Clear existing ranges once when entering the DM screen.
        const selection = window.getSelection?.();
        if (selection && selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    }, []);

    useEffect(() => {
        return () => {
            if (selectedImagePreviewUrl) {
                URL.revokeObjectURL(selectedImagePreviewUrl);
            }
        };
    }, [selectedImagePreviewUrl]);

    const clearSelectedImage = () => {
        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }
        setSelectedImageFile(null);
        setSelectedImagePreviewUrl(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = "";
        }
    };

    const handleImageFile = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be under 5MB.");
            return;
        }

        if (selectedImagePreviewUrl) {
            URL.revokeObjectURL(selectedImagePreviewUrl);
        }

        setSelectedImageFile(file);
        setSelectedImagePreviewUrl(URL.createObjectURL(file));
    };

    const uploadSelectedImage = async (): Promise<{ publicUrl: string; filePath: string } | null> => {
        if (!selectedImageFile || !user) return null;

        const fileExt = selectedImageFile.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("whisper-media")
            .upload(filePath, selectedImageFile);

        if (uploadError) {
            throw uploadError;
        }

        const { data } = supabase.storage.from("whisper-media").getPublicUrl(filePath);
        return { publicUrl: data.publicUrl, filePath };
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMessageText(value);

        if (!targetProfile || !user) return;

        // Broadcast typing=true
        setTyping(true);

        // Debounce typing=false
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            setTyping(false);
        }, 2000);
    };

    const handleComposerDragEnter = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
        if (!hasFiles) return;
        dragDepthRef.current += 1;
        setIsDraggingImage(true);
    };

    const handleComposerDragOver = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
        if (!hasFiles && isDraggingImage) {
            setIsDraggingImage(false);
            dragDepthRef.current = 0;
        }
    };

    const handleComposerDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) {
            setIsDraggingImage(false);
        }
    };

    const handleComposerDrop = (e: React.DragEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragDepthRef.current = 0;
        setIsDraggingImage(false);

        const hasFiles = Array.from(e.dataTransfer.types || []).includes("Files");
        if (!hasFiles) return;
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        handleImageFile(e.dataTransfer.files[0]);
        e.dataTransfer.clearData();
    };


    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!messageText.trim() && !selectedImageFile) || isSending || isUploadingImage || !targetProfile) return;

        // Immediately stop typing indicator on send
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setTyping(false);

        let uploadedPath: string | null = null;
        try {
            let mediaUrl: string | null = null;

            if (selectedImageFile) {
                setIsUploadingImage(true);
                const uploadResult = await uploadSelectedImage();
                if (uploadResult) {
                    mediaUrl = uploadResult.publicUrl;
                    uploadedPath = uploadResult.filePath;
                }
            }

            await sendMessage(messageText.trim(), mediaUrl);
            setMessageText("");
            clearSelectedImage();
        } catch (err) {
            if (uploadedPath) {
                await supabase.storage.from("whisper-media").remove([uploadedPath]).catch(() => { });
            }
            // Toast handled in hook/upload handlers
        } finally {
            setIsUploadingImage(false);
        }
    };

    if (loadingProfile || loadingMessages) {
        return (
            <div
                className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center select-none"
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
            >
                <FrogLoader className=" text-primary" size={32} />
                <p className="mt-4 text-sm text-muted-foreground animate-pulse pointer-events-none">Whispering to the abyss...</p>
            </div>
        );
    }

    if (!targetProfile) return null;


    return (
        <div className="h-[100svh] bg-background text-foreground flex flex-col overflow-hidden">
            <Helmet>
                <title>Whispering to {targetProfile.display_name} — genjutsu</title>
            </Helmet>
            <div className="shrink-0">
                <Navbar />
                <header className="z-40 bg-background/80 backdrop-blur-md border-b-2 border-border shadow-sm">
                    <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => {
                                    if (window.history.length > 2) {
                                        navigate(-1);
                                    } else {
                                        navigate("/whispers");
                                    }
                                }}
                                className="p-2 hover:bg-secondary rounded-[3px] transition-colors"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate(`/u/${targetProfile.username}`)}
                                className="flex items-center gap-2 min-w-0 text-left rounded-[3px] hover:bg-secondary/50 p-1 -m-1 transition-colors"
                                aria-label={`Open ${targetProfile.display_name}'s profile`}
                            >
                                <div className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                    {targetProfile.avatar_url ? (
                                        <img src={targetProfile.avatar_url} alt={targetProfile.username} className="w-full h-full object-cover" />
                                    ) : targetProfile.display_name[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm -mb-0.5 truncate hover:underline">{targetProfile.display_name}</h3>
                                    <p className="text-[10px] text-muted-foreground truncate">@{targetProfile.username}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </header>
            </div>

            <main className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto p-4 space-y-4 scrollbar-hide flex flex-col">
                <div className="flex-1" /> {/* Spacer to push messages to bottom if few */}
                {messages && messages.length > 0 ? (
                    messages.map((whisper: Whisper) => {
                        const isMe = whisper.sender_id === user?.id;
                        const hasText = typeof whisper.content === "string" && whisper.content.trim().length > 0;
                        return (
                            <motion.div
                                key={whisper.id}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 text-sm border-2 rounded-[3px] gum-shadow-sm ${isMe
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-secondary text-secondary-foreground border-border"
                                    }`}>
                                    {hasText ? (
                                        <p className="whitespace-pre-wrap break-words">
                                            {linkify(whisper.content)}
                                        </p>
                                    ) : null}
                                    {whisper.media_url ? (
                                        <button
                                            type="button"
                                            onClick={() => setActiveLightboxImageUrl(whisper.media_url)}
                                            className={`block w-full rounded-[3px] overflow-hidden border border-border/40 cursor-zoom-in ${hasText ? "mt-2" : ""}`}
                                            aria-label="Open whisper image"
                                        >
                                            <img
                                                src={whisper.media_url}
                                                alt="Whisper image"
                                                className="w-full max-h-72 object-cover"
                                                loading="lazy"
                                            />
                                        </button>
                                    ) : null}
                                    {hasText ? <WhisperLinkPreview content={whisper.content} isMe={isMe} /> : null}
                                    <span className={`text-[9px] mt-1.5 block font-mono opacity-60 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                                        {new Date(whisper.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })
                ) : (
                    <div className="py-20 text-center text-xs text-muted-foreground italic flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-[3px] border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                            <Send size={16} className="opacity-40" />
                        </div>
                        This conversation is a void. Start whispering now.
                    </div>
                )}

                <AnimatePresence>
                    {isOtherUserTyping && (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            className="flex justify-start mb-2"
                        >
                            <div className="bg-secondary/30 border-2 border-border/50 rounded-[3px] px-3 py-1.5 flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" />
                                </div>
                                <span className="text-[10px] font-bold text-muted-foreground italic capitalize">
                                    {targetProfile.display_name} is whispering...
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div ref={messagesEndRef} className="h-4" />
            </main>

            <ImagePreviewDialog
                src={activeLightboxImageUrl}
                isOpen={!!activeLightboxImageUrl}
                onOpenChange={(open) => {
                    if (!open) setActiveLightboxImageUrl(null);
                }}
                alt="Whisper image preview"
            />

            <footer className={`shrink-0 bg-background/95 backdrop-blur-md border-t-2 p-4 pb-safe transition-colors ${isDraggingImage ? "border-primary bg-primary/5" : "border-border"}`}>
                <form
                    onSubmit={handleSend}
                    onDragEnter={handleComposerDragEnter}
                    onDragOver={handleComposerDragOver}
                    onDragLeave={handleComposerDragLeave}
                    onDrop={handleComposerDrop}
                    autoComplete="off"
                    className="max-w-4xl mx-auto space-y-2.5"
                >
                    {isDraggingImage ? (
                        <div className="text-center text-xs font-semibold text-primary py-1">
                            Drop image to attach to this whisper
                        </div>
                    ) : null}
                    {selectedImagePreviewUrl ? (
                        <div className="relative w-24 h-24 rounded-[3px] overflow-hidden border-2 border-border">
                            <img src={selectedImagePreviewUrl} alt="Selected whisper upload" className="w-full h-full object-cover" />
                            <button
                                type="button"
                                onClick={clearSelectedImage}
                                className="absolute top-1 right-1 p-1 rounded-full bg-background/85 hover:bg-background transition-colors"
                                aria-label="Remove selected image"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ) : null}

                    <div className="flex gap-3">
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleImageFile(e.target.files?.[0] || null)}
                        />

                        <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="h-10 w-10 shrink-0 gum-border bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-colors"
                            title="Attach image"
                            aria-label="Attach image"
                        >
                            <ImageIcon size={16} />
                        </button>

                        <input
                            type="text"
                            id="whisper-message-input"
                            name="whisper-message"
                            value={messageText}
                            onChange={handleInputChange}
                            placeholder="Type a whisper... they vanish in 24h"
                            className="flex-1 bg-secondary/50 gum-border py-2.5 px-4 outline-none focus:border-primary transition-colors text-sm"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            enterKeyHint="send"
                        />
                        <button
                            type="submit"
                            disabled={(!messageText.trim() && !selectedImageFile) || isSending || isUploadingImage}
                            className="gum-btn bg-primary text-primary-foreground px-5 h-10 flex items-center gap-2"
                        >
                            {(isSending || isUploadingImage) ? <FrogLoader size={16} className="" /> : <Send size={16} />}
                            <span className="hidden sm:inline">Whisper</span>
                        </button>
                    </div>
                </form>
            </footer>
        </div>
    );
};

export default ChatPage;
