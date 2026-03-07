import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserPlus, UserCheck, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FollowsListProps {
    userId: string;
    type: "followers" | "following";
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onAction?: () => void;
}

interface FollowUser {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string;
    bio: string;
    is_following?: boolean;
}

const FollowsList = ({ userId, type, isOpen, onOpenChange, onAction }: FollowsListProps) => {
    const [users, setUsers] = useState<FollowUser[]>([]);
    const [loading, setLoading] = useState(false);
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    const fetchUsers = async () => {
        if (!userId || !isOpen) return;

        try {
            setLoading(true);

            // 1. Fetch Follow Relationship IDs
            const { data: followsData, error: followsError } = await supabase
                .from("follows")
                .select(type === "followers" ? "follower_id" : "following_id")
                .eq(type === "followers" ? "following_id" : "follower_id", userId);

            if (followsError) throw followsError;

            if (!followsData || followsData.length === 0) {
                setUsers([]);
                setLoading(false);
                return;
            }

            const targetIds = followsData.map((f: any) => type === "followers" ? f.follower_id : f.following_id);

            // 2. Fetch Profiles for those IDs
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("user_id, username, display_name, avatar_url, bio")
                .in("user_id", targetIds);

            if (profilesError) throw profilesError;

            if (profilesData) {
                // Map data to the interface
                let extractedUsers = profilesData as FollowUser[];

                // 3. If logged in, check which ones the current user follows
                if (currentUser) {
                    const { data: myFollows } = await supabase
                        .from("follows")
                        .select("following_id")
                        .eq("follower_id", currentUser.id)
                        .in("following_id", targetIds);

                    const myFollowedIds = new Set((myFollows || []).map(f => f.following_id));

                    setUsers(extractedUsers.map(u => ({
                        ...u,
                        is_following: myFollowedIds.has(u.user_id)
                    })));
                } else {
                    setUsers(extractedUsers);
                }
            }
        } catch (err: any) {
            console.error("Error fetching follows list:", err);
            toast.error("Failed to load list");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, [userId, type, isOpen, currentUser]);

    const handleToggleFollow = async (e: React.MouseEvent, targetUser: FollowUser) => {
        e.stopPropagation();
        if (!currentUser) {
            toast.error("Please sign in to follow");
            return;
        }

        try {
            if (targetUser.is_following) {
                const { data, error } = await supabase.from("follows")
                    .delete()
                    .eq("follower_id", currentUser.id)
                    .eq("following_id", targetUser.user_id)
                    .select();
                if (error) throw error;
                if (!data || data.length === 0) throw new Error("violates row-level security policy");
                setUsers(prev => prev.map(u => u.user_id === targetUser.user_id ? { ...u, is_following: false } : u));
                toast.success(`Unfollowed @${targetUser.username}`);
            } else {
                const { error } = await supabase.from("follows").insert({
                    follower_id: currentUser.id,
                    following_id: targetUser.user_id
                });
                if (error) throw error;
                setUsers(prev => prev.map(u => u.user_id === targetUser.user_id ? { ...u, is_following: true } : u));
                toast.success(`Following @${targetUser.username}`);
            }
            if (onAction) onAction();
        } catch (err: any) {
            const msg = err?.message || "";
            const code = err?.code;
            if (
                msg.includes("violates row-level security policy") ||
                msg.includes("permission denied") ||
                code === "PGRST301" ||
                code === "42501"
            ) {
                toast.error("You are banned from following or unfollowing users right now.");
            } else {
                toast.error("Action failed");
            }
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[400px] gum-card border-2 border-foreground p-0 overflow-hidden max-h-[80vh] flex flex-col"
            >
                <DialogHeader className="p-4 bg-secondary border-b-2 border-foreground">
                    <DialogTitle className="text-lg font-bold capitalize">
                        {type}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        List of users who are {type} of the profile
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="animate-spin text-muted-foreground" size={24} />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No {type} yet.
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {users.map((item) => (
                                <div
                                    key={item.user_id}
                                    onClick={() => {
                                        onOpenChange(false);
                                        navigate(`/${item.username}`);
                                    }}
                                    className="flex items-center gap-3 p-3 rounded-[3px] hover:bg-secondary cursor-pointer transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-[3px] gum-border bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                        {item.avatar_url ? (
                                            <img src={item.avatar_url} alt={item.username} className="w-full h-full object-cover" />
                                        ) : item.display_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate group-hover:underline">{item.display_name}</p>
                                        <p className="text-xs text-muted-foreground truncate">@{item.username}</p>
                                    </div>

                                    {currentUser && currentUser.id !== item.user_id && (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onOpenChange(false);
                                                    navigate(`/whisper/${item.username}`);
                                                }}
                                                className="p-1.5 rounded-[3px] bg-secondary hover:bg-primary hover:text-primary-foreground transition-all gum-border"
                                                title="Whisper"
                                            >
                                                <Send size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleFollow(e, item)}
                                                className={`gum-btn text-[10px] px-3 py-1.5 h-8 transition-colors ${item.is_following
                                                    ? "bg-secondary text-secondary-foreground"
                                                    : "bg-primary text-primary-foreground"
                                                    }`}
                                            >
                                                {item.is_following ? "Following" : "Follow"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default FollowsList;
