import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCallback } from "react";

export interface EditPostInput {
    postId: string;
    content: string;
    code: string;
    codeLanguage: string | null;
    tags: string[];
    mediaUrl: string;
    isReadme: boolean;
    oldMediaUrl?: string | null;
}

export interface EditPostResult {
    postId: string;
    editedAt: string;
    oldMediaCleanupFailed?: boolean;
}

function getPostMediaStoragePath(mediaUrl: string): string | null {
    const parts = mediaUrl.split("post-media/");
    if (parts.length < 2) return null;
    const path = parts[1].split(/[?#]/)[0];
    return path || null;
}

export function usePostActions() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const removePostMediaByUrl = useCallback(async (mediaUrl: string | null | undefined): Promise<boolean> => {
        if (!mediaUrl || !mediaUrl.includes("post-media")) return true;

        try {
            const storagePath = getPostMediaStoragePath(mediaUrl);
            if (!storagePath) return true;

            for (let attempt = 1; attempt <= 2; attempt += 1) {
                const { error } = await supabase.storage
                    .from("post-media")
                    .remove([storagePath]);

                if (!error) return true;

                if (attempt === 2) {
                    console.error("Storage cleanup failed:", error);
                    return false;
                }
            }
        } catch (err) {
            console.error("Error parsing media_url for cleanup:", err);
            return false;
        }

        return false;
    }, []);

    const toggleLikeMutation = useMutation({
        mutationFn: async ({ postId, currentlyLiked }: { postId: string, currentlyLiked: boolean }) => {
            if (!user) throw new Error("Not authenticated");
            if (currentlyLiked) {
                await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", postId);
            } else {
                await supabase.from("likes").insert({ user_id: user.id, post_id: postId });
            }
        },
        onMutate: async ({ postId, currentlyLiked }) => {
            await queryClient.cancelQueries({ queryKey: ["posts"] }); // Cancel all post-related queries
            const previousData = queryClient.getQueriesData({ queryKey: ["posts"] });

            queryClient.setQueriesData({ queryKey: ["posts"] }, (old: any) => {
                if (!old) return old;

                // Handle infinite query data (Index page)
                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any[]) =>
                            page.map((post) =>
                                post.id === postId
                                    ? {
                                        ...post,
                                        user_liked: !currentlyLiked,
                                        likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1,
                                    }
                                    : post
                            )
                        ),
                    };
                }

                // Handle single post data (Post page)
                if (old.id === postId) {
                    return {
                        ...old,
                        user_liked: !currentlyLiked,
                        likes_count: currentlyLiked ? old.likes_count - 1 : old.likes_count + 1,
                    };
                }

                // Handle standard array data (Profile, Search)
                if (Array.isArray(old)) {
                    return old.map(post =>
                        post.id === postId
                            ? {
                                ...post,
                                user_liked: !currentlyLiked,
                                likes_count: currentlyLiked ? post.likes_count - 1 : post.likes_count + 1,
                            }
                            : post
                    );
                }

                return old;
            });

            return { previousData };
        },
        onError: (err: any, variables, context) => {
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            const msg = err?.message || "";
            if (msg.includes("violates row-level security policy") || msg.includes("permission denied")) {
                toast.error("You are banned from liking posts right now.");
            } else {
                toast.error("Couldn't resonate with this post. Try again!");
            }
        },
        // No onSettled invalidation — optimistic update in onMutate handles UI state.
        // Invalidating here would trigger a full 3-query re-fetch after every like.
    });

    const toggleBookmarkMutation = useMutation({
        mutationFn: async ({ postId, currentlyBookmarked }: { postId: string, currentlyBookmarked: boolean }) => {
            if (!user) throw new Error("Not authenticated");
            if (currentlyBookmarked) {
                await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("post_id", postId);
            } else {
                await supabase.from("bookmarks").insert({ user_id: user.id, post_id: postId });
            }
        },
        onMutate: async ({ postId, currentlyBookmarked }) => {
            await queryClient.cancelQueries({ queryKey: ["posts"] });
            const previousData = queryClient.getQueriesData({ queryKey: ["posts"] });

            queryClient.setQueriesData({ queryKey: ["posts"] }, (old: any) => {
                if (!old) return old;

                if (old.pages) {
                    return {
                        ...old,
                        pages: old.pages.map((page: any[]) =>
                            page.map((post) =>
                                post.id === postId ? { ...post, user_bookmarked: !currentlyBookmarked } : post
                            )
                        ),
                    };
                }

                if (old.id === postId) {
                    return { ...old, user_bookmarked: !currentlyBookmarked };
                }

                if (Array.isArray(old)) {
                    return old.map(post =>
                        post.id === postId ? { ...post, user_bookmarked: !currentlyBookmarked } : post
                    );
                }

                return old;
            });

            return { previousData };
        },
        onError: (err: any, variables, context) => {
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            const msg = err?.message || "";
            if (msg.includes("violates row-level security policy") || msg.includes("permission denied")) {
                toast.error("You are banned from bookmarking posts right now.");
            } else {
                toast.error("Couldn't preserve this memory. Try again!");
            }
        },
        // No onSettled invalidation — optimistic update in onMutate handles UI state.
    });

    const deletePostMutation = useMutation({
        mutationFn: async (postId: string) => {
            if (!user) throw new Error("Not authenticated");

            // 1. Get post data first to check for media_url
            const { data: post } = await supabase
                .from("posts")
                .select("media_url")
                .eq("id", postId)
                .single();

            // 2. Clean up storage if media_url exists
            await removePostMediaByUrl(post?.media_url);

            // 3. Delete the post record
            // Related likes, comments, and bookmarks will be deleted automatically 
            // by the database thanks to ON DELETE CASCADE constraints.
            const { error: deleteError } = await supabase
                .from("posts")
                .delete()
                .eq("id", postId)
                .eq("user_id", user.id);

            if (deleteError) throw deleteError;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            queryClient.invalidateQueries({ queryKey: ["trending-tags"] });
            toast.success("Post deleted");
        },
        onError: () => {
            toast.error("This post didn't want to vanish yet. Please try again.");
        }
    });

    const editPostMutation = useMutation({
        mutationFn: async (input: EditPostInput): Promise<EditPostResult> => {
            if (!user) throw new Error("Not authenticated");

            const { postId, content, code, codeLanguage, tags, mediaUrl, isReadme, oldMediaUrl } = input;

            const { data, error } = await (supabase.rpc as any)("edit_post", {
                p_post_id: postId,
                p_content: content,
                p_code: code || "",
                p_tags: tags,
                p_media_url: mediaUrl || "",
                p_is_readme: isReadme,
                p_code_language: codeLanguage || null,
            });

            if (error) throw error;

            const result = data as any;
            if (result?.error === "no_changes") throw new Error("NO_CHANGES");
            if (result?.error === "expired") throw new Error("POST_EXPIRED");
            if (result?.error === "not_authorized") throw new Error("NOT_AUTHORIZED");
            if (result?.error === "post_not_found") throw new Error("POST_NOT_FOUND");
            if (result?.error === "banned") {
                if (result?.ban_permanent) throw new Error("BANNED_POST_PERMANENT");
                throw new Error(`BANNED_POST:${result?.banned_until || ""}`);
            }
            if (result?.error) throw new Error(result?.message || "Failed to edit post");

            let oldMediaCleanupFailed = false;
            if (oldMediaUrl && oldMediaUrl !== mediaUrl) {
                const cleaned = await removePostMediaByUrl(oldMediaUrl);
                oldMediaCleanupFailed = !cleaned;
            }

            return {
                postId: result?.post_id || postId,
                editedAt: result?.edited_at || new Date().toISOString(),
                oldMediaCleanupFailed,
            };
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            queryClient.invalidateQueries({ queryKey: ["trending-tags"] });
            if (result?.oldMediaCleanupFailed) {
                toast.info("Post updated. Couldn't clean up the old image automatically.");
                return;
            }
            toast.success("Post updated");
        },
        onError: (error: any) => {
            const msg = error?.message || "";

            if (msg === "NO_CHANGES") {
                toast.info("No changes to save.");
                return;
            }
            if (msg === "POST_EXPIRED") {
                toast.error("This post has expired and can no longer be edited.");
                return;
            }
            if (msg === "NOT_AUTHORIZED" || msg === "POST_NOT_FOUND") {
                toast.error("You can't edit this post.");
                return;
            }
            if (msg === "BANNED_POST_PERMANENT") {
                toast.error("You are permanently banned from posting.");
                return;
            }
            if (msg.startsWith("BANNED_POST:")) {
                const untilRaw = msg.substring("BANNED_POST:".length);
                if (untilRaw) {
                    const until = new Date(untilRaw);
                    toast.error(`You are banned from posting until ${until.toLocaleString()}.`);
                } else {
                    toast.error("You are currently banned from posting.");
                }
                return;
            }

            toast.error("Couldn't edit this post right now. Please try again.");
        },
    });

    const toggleLike = useCallback((postId: string, currentlyLiked: boolean) => {
        if (!user) {
            toast.error("Please sign in to like posts");
            return;
        }
        toggleLikeMutation.mutate({ postId, currentlyLiked });
    }, [user, toggleLikeMutation]);

    const toggleBookmark = useCallback((postId: string, currentlyBookmarked: boolean) => {
        if (!user) {
            toast.error("Please sign in to bookmark posts");
            return;
        }
        toggleBookmarkMutation.mutate({ postId, currentlyBookmarked });
    }, [user, toggleBookmarkMutation]);

    const deletePost = useCallback(async (postId: string) => {
        if (!user) {
            toast.error("Please sign in to delete posts");
            return;
        }
        return deletePostMutation.mutateAsync(postId);
    }, [user, deletePostMutation]);

    const editPost = useCallback(async (input: EditPostInput) => {
        if (!user) {
            toast.error("Please sign in to edit posts");
            throw new Error("NOT_AUTHENTICATED");
        }
        return editPostMutation.mutateAsync(input);
    }, [user, editPostMutation]);

    return {
        toggleLike,
        toggleBookmark,
        deletePost,
        editPost,
    };
}
