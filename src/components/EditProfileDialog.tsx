import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit3, Loader2, Upload, Camera, Link as LinkIcon, ChevronDown, ChevronUp, Music, Search, Play, Pause, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getNow } from "@/lib/utils";

interface EditProfileDialogProps {
    currentProfile: {
        display_name: string;
        bio: string;
        avatar_url: string | null;
        banner_url: string | null;
        social_links?: Record<string, string>;
        fav_song?: any;
    };
    onUpdate: () => void;
}

const EditProfileDialog = ({ currentProfile, onUpdate }: EditProfileDialogProps) => {
    const [displayName, setDisplayName] = useState(currentProfile.display_name);
    const [bio, setBio] = useState(currentProfile.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatar_url || "");
    const [bannerUrl, setBannerUrl] = useState(currentProfile.banner_url || "");
    const [socialLinks, setSocialLinks] = useState<Record<string, string>>(currentProfile.social_links || {});
    const [favSong, setFavSong] = useState<any>(currentProfile.fav_song || null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [showUrls, setShowUrls] = useState(false);
    const [showSocials, setShowSocials] = useState(false);
    const [showMusic, setShowMusic] = useState(false);
    const [songQuery, setSongQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [open, setOpen] = useState(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setDisplayName(currentProfile.display_name);
            setBio(currentProfile.bio || "");
            setAvatarUrl(currentProfile.avatar_url || "");
            setBannerUrl(currentProfile.banner_url || "");
            setSocialLinks(currentProfile.social_links || {});
            setFavSong(currentProfile.fav_song || null);
            setShowMusic(false);
            setSearchResults([]);
            setSongQuery("");
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
                setPlayingPreview(null);
            }
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bucket: 'avatars' | 'banners') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("That file is a bit too heavy! Please keep it under 2MB.");
            return;
        }

        const isAvatar = bucket === 'avatars';
        if (isAvatar) setUploadingAvatar(true);
        else setUploadingBanner(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Authentication required");

            // Old file cleanup is handled in handleSubmit's cleanupOldFile()

            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

            if (isAvatar) setAvatarUrl(data.publicUrl);
            else setBannerUrl(data.publicUrl);

            toast.success(`${bucket.slice(0, -1).charAt(0).toUpperCase() + bucket.slice(1, -1)} uploaded!`);
        } catch (error: any) {
            console.error(`Error uploading ${bucket}:`, error);
            toast.error(`We couldn't upload your ${bucket.slice(0, -1)}. Please check your connection and try again.`);
        } finally {
            if (isAvatar) setUploadingAvatar(false);
            else setUploadingBanner(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) {
            toast.error("Display name is required");
            return;
        }

        try {
            setSubmitting(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // --- AUTO-DELETE OLD FILES IF URL CHANGED ---
            const cleanupOldFile = async (oldUrl: string | null, newUrl: string | null, bucket: 'avatars' | 'banners') => {
                const bucketUrl = supabase.storage.from(bucket).getPublicUrl('').data.publicUrl;
                if (oldUrl && oldUrl.includes(bucketUrl) && oldUrl !== newUrl) {
                    const oldPath = oldUrl.split(`${bucket}/`).pop();
                    if (oldPath) {
                        await supabase.storage.from(bucket).remove([oldPath]);
                        console.log(`Cleaned up old ${bucket.slice(0, -1)} from storage:`, oldPath);
                    }
                }
            };

            await Promise.all([
                cleanupOldFile(currentProfile.avatar_url, avatarUrl, 'avatars'),
                cleanupOldFile(currentProfile.banner_url, bannerUrl, 'banners')
            ]);
            // --------------------------------------------

            const { error } = await supabase
                .from("profiles")
                .update({
                    display_name: displayName,
                    bio: bio,
                    avatar_url: avatarUrl,
                    banner_url: bannerUrl,
                    social_links: socialLinks,
                    fav_song: favSong,
                    updated_at: getNow().toISOString(),
                })
                .eq("user_id", user.id);

            if (error) throw error;

            toast.success("Profile updated successfully!");
            setOpen(false);
            onUpdate();
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast.error("Something went wrong while updating your identity. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const searchSongs = async () => {
        if (!songQuery.trim()) return;
        setSearching(true);
        try {
            const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(songQuery)}&entity=song&limit=20`);
            const data = await response.json();
            setSearchResults(data.results || []);
        } catch (error) {
            console.error("Error searching songs:", error);
            toast.error("Failed to search songs");
        } finally {
            setSearching(false);
        }
    };

    const togglePreview = (previewUrl: string) => {
        if (playingPreview === previewUrl) {
            audioRef.current?.pause();
            setPlayingPreview(null);
        } else {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            const audio = new Audio(previewUrl);
            audio.play();
            audioRef.current = audio;
            setPlayingPreview(previewUrl);
            audio.onended = () => setPlayingPreview(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="gum-btn border-2 border-foreground flex items-center gap-2 text-sm">
                    <Edit3 size={16} /> Edit Profile
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-none w-full h-full max-h-none rounded-none gum-card border-none p-0 overflow-hidden flex flex-col [&>button:last-child]:hidden">
                <DialogDescription className="sr-only">Update your display name, bio, social links, and profile images.</DialogDescription>
                <form onSubmit={handleSubmit} className="flex flex-col h-full bg-background overflow-hidden">
                    {/* Top Navigation Bar */}
                    <div className="flex items-center justify-between p-4 border-b-2 border-foreground bg-secondary shrink-0 z-10">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="text-sm font-bold hover:underline px-4 py-2"
                        >
                            Cancel
                        </button>
                        <DialogTitle className="text-lg font-bold">Edit Profile</DialogTitle>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-primary text-primary-foreground px-4 sm:px-8 py-2 rounded-[3px] font-bold border-2 border-foreground hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Save"}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_400px] gap-6 sm:gap-8 p-4 sm:p-6 lg:p-12">
                            {/* Left Column: Visual Previews */}
                            <div className="space-y-6">
                                <Label className="font-bold text-xl block mb-4">Profile Appearance</Label>
                                <div className="bg-secondary/5 rounded-[3px] border-2 border-foreground/10">
                                    {/* Banner Preview */}
                                    <div className="h-40 sm:h-72 w-full bg-muted relative group overflow-hidden border-b-2 border-foreground/10 rounded-t-[3px]">
                                        {bannerUrl ? (
                                            <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary/20">
                                                No Banner Image
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button
                                                type="button"
                                                onClick={() => bannerInputRef.current?.click()}
                                                disabled={uploadingBanner}
                                                className="p-5 bg-background shadow-xl rounded-full hover:bg-secondary gum-border transition-all transform scale-90 group-hover:scale-100"
                                            >
                                                {uploadingBanner ? <Loader2 className="animate-spin" size={28} /> : <Camera size={28} />}
                                            </button>
                                        </div>
                                        <input
                                            type="file"
                                            className="hidden"
                                            ref={bannerInputRef}
                                            accept="image/*"
                                            onChange={(e) => handleFileUpload(e, 'banners')}
                                        />
                                    </div>

                                    {/* Avatar Preview — inline on mobile, absolute on sm+ */}
                                    <div className="flex sm:block">
                                        {/* Mobile: centered inline avatar below banner */}
                                        <div className="sm:hidden flex justify-center -mt-12 pb-4 w-full">
                                            <div className="relative group w-24 h-24 rounded-[3px] gum-border border-[4px] border-background bg-secondary overflow-hidden shadow-2xl">
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-secondary">
                                                        {displayName[0]?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => avatarInputRef.current?.click()}
                                                        disabled={uploadingAvatar}
                                                        className="p-2 bg-background shadow-xl rounded-full hover:bg-secondary gum-border transition-all"
                                                    >
                                                        {uploadingAvatar ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                                                    </button>
                                                </div>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    ref={avatarInputRef}
                                                    accept="image/*"
                                                    onChange={(e) => handleFileUpload(e, 'avatars')}
                                                />
                                            </div>
                                        </div>
                                        {/* Desktop: absolute overlapping avatar */}
                                        <div className="hidden sm:block relative h-20">
                                            <div className="absolute -top-16 left-8">
                                                <div className="relative group w-40 h-40 rounded-[3px] gum-border border-[6px] border-background bg-secondary overflow-hidden shadow-2xl">
                                                    {avatarUrl ? (
                                                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-3xl font-bold bg-secondary">
                                                            {displayName[0]?.toUpperCase() || "?"}
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => avatarInputRef.current?.click()}
                                                            disabled={uploadingAvatar}
                                                            className="p-3 bg-background shadow-xl rounded-full hover:bg-secondary gum-border transition-all transform scale-90 group-hover:scale-100"
                                                        >
                                                            {uploadingAvatar ? <Loader2 className="animate-spin" size={24} /> : <Camera size={24} />}
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        ref={avatarInputRef}
                                                        accept="image/*"
                                                        onChange={(e) => handleFileUpload(e, 'avatars')}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Profile Info */}
                            <div className="space-y-8 lg:sticky lg:top-0 h-fit">
                                <div className="space-y-4">
                                    <Label htmlFor="displayName" className="font-bold text-lg block">Display Name</Label>
                                    <Input
                                        id="displayName"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="gum-border focus-visible:ring-primary text-lg p-4 sm:p-7 bg-background"
                                        placeholder="What should we call you?"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label htmlFor="bio" className="font-bold text-lg block">Bio</Label>
                                    <Textarea
                                        id="bio"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="gum-border focus-visible:ring-primary min-h-[180px] text-lg p-4 sm:p-5 bg-background resize-none"
                                        placeholder="Write something about yourself..."
                                    />
                                </div>

                                {/* Social Links Section */}
                                <div className="pt-6 border-t border-foreground/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowSocials(!showSocials)}
                                        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all p-3 rounded-[3px] hover:bg-secondary/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-widest">
                                            <LinkIcon size={14} />
                                            {showSocials ? "Hide Social Platforms" : "Add Social Platforms"}
                                        </div>
                                        {showSocials ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showSocials && (
                                        <div className="mt-4 space-y-4 p-6 bg-secondary/5 rounded-[3px] gum-border animate-in slide-in-from-top-4 duration-300">
                                            {[
                                                { id: 'github', label: 'GitHub', placeholder: 'github.com/username' },
                                                { id: 'twitter', label: 'Twitter / X', placeholder: 'twitter.com/username' },
                                                { id: 'facebook', label: 'Facebook', placeholder: 'facebook.com/username' },
                                                { id: 'website', label: 'Website', placeholder: 'yourwebsite.com' }
                                            ].map((platform) => (
                                                <div key={platform.id} className="space-y-2">
                                                    <Label htmlFor={platform.id} className="text-[10px] font-black uppercase tracking-wider opacity-60">
                                                        {platform.label} link</Label>
                                                    <Input
                                                        id={platform.id}
                                                        value={socialLinks[platform.id] || ""}
                                                        onChange={(e) => setSocialLinks(prev => ({ ...prev, [platform.id]: e.target.value }))}
                                                        className="h-11 text-sm gum-border focus-visible:ring-primary bg-background"
                                                        placeholder={platform.placeholder}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Favorite Song Section */}
                                <div className="pt-6 border-t border-foreground/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowMusic(!showMusic)}
                                        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all p-3 rounded-[3px] hover:bg-secondary/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-widest">
                                            <Music size={14} />
                                            {favSong ? "Change Profile Music" : "Add Profile Music"}
                                        </div>
                                        {showMusic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showMusic && (
                                        <div className="mt-4 space-y-4 p-6 bg-secondary/5 rounded-[3px] gum-border animate-in slide-in-from-top-4 duration-300">
                                            {favSong && (
                                                <div className="flex items-center gap-4 p-4 bg-background rounded-[3px] gum-border mb-4">
                                                    <img src={favSong.artworkUrl100} className="w-12 h-12 rounded-[3px] object-cover" alt="" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-sm truncate">{favSong.trackName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{favSong.artistName}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFavSong(null)}
                                                        className="p-2 hover:bg-secondary rounded-full transition-colors"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <Input
                                                        value={songQuery}
                                                        onChange={(e) => setSongQuery(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchSongs())}
                                                        className="gum-border bg-background pl-10"
                                                        placeholder="Search artists or songs..."
                                                    />
                                                    <Music className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={searchSongs}
                                                    disabled={searching}
                                                    className="bg-secondary p-3 rounded-[3px] border-2 border-foreground hover:opacity-80 disabled:opacity-50"
                                                >
                                                    {searching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                                                </button>
                                            </div>

                                            <div className="space-y-2 mt-4">
                                                {searchResults.map((song) => (
                                                    <div
                                                        key={song.trackId}
                                                        className="flex items-center gap-3 p-3 bg-background rounded-[3px] hover:bg-secondary/50 transition-colors cursor-pointer group border-2 border-transparent hover:border-foreground/10"
                                                        onClick={() => setFavSong(song)}
                                                    >
                                                        <div className="relative w-10 h-10 shrink-0">
                                                            <img src={song.artworkUrl100} className="w-full h-full rounded-[3px] object-cover" alt="" />
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    togglePreview(song.previewUrl);
                                                                }}
                                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity rounded-[3px]"
                                                            >
                                                                {playingPreview === song.previewUrl ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                                            </button>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-xs truncate">{song.trackName}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{song.artistName}</p>
                                                        </div>
                                                        {favSong?.trackId === song.trackId && (
                                                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* URL Toggles */}
                                <div className="pt-8 border-t border-foreground/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowUrls(!showUrls)}
                                        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all p-3 rounded-[3px] hover:bg-secondary/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <LinkIcon size={14} />
                                            {showUrls ? "Hide Advanced Settings" : "Show Advanced: Edit via URL"}
                                        </div>
                                        {showUrls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showUrls && (
                                        <div className="mt-4 space-y-6 p-6 bg-secondary/5 rounded-[3px] gum-border animate-in slide-in-from-top-4 duration-300">
                                            <div className="space-y-3">
                                                <Label htmlFor="avatarUrl" className="text-xs font-bold uppercase tracking-wider opacity-60">Custom Avatar URL</Label>
                                                <Input
                                                    id="avatarUrl"
                                                    value={avatarUrl}
                                                    onChange={(e) => setAvatarUrl(e.target.value)}
                                                    className="h-12 text-sm gum-border focus-visible:ring-primary bg-background"
                                                    placeholder="https://example.com/avatar.png"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label htmlFor="bannerUrl" className="text-xs font-bold uppercase tracking-wider opacity-60">Custom Banner URL</Label>
                                                <Input
                                                    id="bannerUrl"
                                                    value={bannerUrl}
                                                    onChange={(e) => setBannerUrl(e.target.value)}
                                                    className="h-12 text-sm gum-border focus-visible:ring-primary bg-background"
                                                    placeholder="https://example.com/banner.png"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </DialogContent>

        </Dialog>
    );
};


export default EditProfileDialog;