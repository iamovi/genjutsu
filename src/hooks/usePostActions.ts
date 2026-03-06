import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function usePostActions() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] });
        },
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
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] });
        },
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
            if (post?.media_url && post.media_url.includes('post-media')) {
                try {
                    // Extract the storage path after 'post-media/'
                    // URL format: https://xxx.supabase.co/storage/v1/object/public/post-media/0.12345.jpg
                    // or with folder: .../post-media/userId/0.12345.jpg
                    const parts = post.media_url.split('post-media/');
                    if (parts.length > 1) {
                        const storagePath = parts[1].split(/[?#]/)[0]; // strip query params
                        console.log("Deleting storage file:", storagePath);

                        const { error: storageError, data: storageData } = await supabase.storage
                            .from("post-media")
                            .remove([storagePath]);

                        if (storageError) {
                            console.error("Storage cleanup failed:", storageError);
                        } else {
                            console.log("Storage cleanup success:", storageData);
                        }
                    }
                } catch (err) {
                    console.error("Error parsing media_url for cleanup:", err);
                }
            }

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
            toast.success("Post deleted");
        },
        onError: () => {
            toast.error("This post didn't want to vanish yet. Please try again.");
        }
    });

    return {
        toggleLike: (postId: string, currentlyLiked: boolean) => {
            if (!user) {
                toast.error("Please sign in to like posts");
                return;
            }
            toggleLikeMutation.mutate({ postId, currentlyLiked });
        },
        toggleBookmark: (postId: string, currentlyBookmarked: boolean) => {
            if (!user) {
                toast.error("Please sign in to bookmark posts");
                return;
            }
            toggleBookmarkMutation.mutate({ postId, currentlyBookmarked });
        },
        async deletePost(postId: string) {
            if (!user) {
                toast.error("Please sign in to delete posts");
                return;
            }
            return deletePostMutation.mutateAsync(postId);
        },
    };
}
