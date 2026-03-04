import { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Edit3, Loader2, Upload, Camera, Link as LinkIcon, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getNow } from "@/lib/utils";

interface EditProfileDialogProps {
    currentProfile: {
        display_name: string;
        bio: string;
        avatar_url: string | null;
        banner_url: string | null;
    };
    onUpdate: () => void;
}

const EditProfileDialog = ({ currentProfile, onUpdate }: EditProfileDialogProps) => {
    const [displayName, setDisplayName] = useState(currentProfile.display_name);
    const [bio, setBio] = useState(currentProfile.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(currentProfile.avatar_url || "");
    const [bannerUrl, setBannerUrl] = useState(currentProfile.banner_url || "");
    const [submitting, setSubmitting] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [showUrls, setShowUrls] = useState(false);
    const [open, setOpen] = useState(false);

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setDisplayName(currentProfile.display_name);
            setBio(currentProfile.bio || "");
            setAvatarUrl(currentProfile.avatar_url || "");
            setBannerUrl(currentProfile.banner_url || "");
        }
    }, [open, currentProfile]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bucket: 'avatars' | 'banners') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error("File size must be less than 2MB");
            return;
        }

        const isAvatar = bucket === 'avatars';
        if (isAvatar) setUploadingAvatar(true);
        else setUploadingBanner(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Authentication required");

            // --- AUTO-DELETE OLD FILE ---
            const oldUrl = isAvatar ? avatarUrl : bannerUrl;
            if (oldUrl && oldUrl.includes(supabase.storage.from(bucket).getPublicUrl('').data.publicUrl)) {
                try {
                    const oldPath = oldUrl.split(`${bucket}/`).pop();
                    if (oldPath) {
                        await supabase.storage.from(bucket).remove([oldPath]);
                        console.log(`Deleted old ${bucket.slice(0, -1)}:`, oldPath);
                    }
                } catch (deleteError) {
                    console.error(`Error deleting old ${bucket}:`, deleteError);
                    // We don't throw here to ensure the new upload still proceeds
                }
            }
            // ----------------------------

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
            toast.error(`Failed to upload ${bucket.slice(0, -1)}`);
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
                    updated_at: getNow().toISOString(),
                })
                .eq("user_id", user.id);

            if (error) throw error;

            toast.success("Profile updated successfully!");
            setOpen(false);
            onUpdate();
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast.error(error.message || "Failed to update profile");
        } finally {
            setSubmitting(false);
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
                            className="bg-primary text-primary-foreground px-8 py-2 rounded-lg font-bold border-2 border-foreground hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Save"}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_400px] gap-8 p-6 lg:p-12">
                            {/* Left Column: Visual Previews */}
                            <div className="space-y-6">
                                <Label className="font-bold text-xl block mb-4">Profile Appearance</Label>
                                <div className="relative mb-24 bg-secondary/5 rounded-2xl border-2 border-foreground/10">
                                    {/* Banner Preview */}
                                    <div className="h-48 sm:h-72 w-full bg-muted relative group overflow-hidden border-b-2 border-foreground/10 rounded-t-2xl">
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

                                    {/* Avatar Preview */}
                                    <div className="absolute -bottom-16 left-8">
                                        <div className="relative group w-40 h-40 rounded-2xl gum-border border-[6px] border-background bg-secondary overflow-hidden shadow-2xl">
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

                            {/* Right Column: Profile Info */}
                            <div className="space-y-10 lg:sticky lg:top-0 h-fit">
                                <div className="space-y-4">
                                    <Label htmlFor="displayName" className="font-bold text-lg block">Display Name</Label>
                                    <Input
                                        id="displayName"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="gum-border focus-visible:ring-primary text-lg p-7 bg-background"
                                        placeholder="What should we call you?"
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label htmlFor="bio" className="font-bold text-lg block">Bio</Label>
                                    <Textarea
                                        id="bio"
                                        value={bio}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="gum-border focus-visible:ring-primary min-h-[180px] text-lg p-5 bg-background resize-none"
                                        placeholder="Write something about yourself..."
                                    />
                                </div>

                                {/* URL Toggles */}
                                <div className="pt-8 border-t border-foreground/5">
                                    <button
                                        type="button"
                                        onClick={() => setShowUrls(!showUrls)}
                                        className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all p-3 rounded-xl hover:bg-secondary/50 w-full justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <LinkIcon size={14} />
                                            {showUrls ? "Hide Advanced Settings" : "Show Advanced: Edit via URL"}
                                        </div>
                                        {showUrls ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>

                                    {showUrls && (
                                        <div className="mt-4 space-y-6 p-6 bg-secondary/5 rounded-2xl gum-border animate-in slide-in-from-top-4 duration-300">
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
