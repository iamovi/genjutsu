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
        onError: (err, variables, context) => {
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            toast.error("Failed to update like");
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
        onError: (err, variables, context) => {
            if (context?.previousData) {
                context.previousData.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data);
                });
            }
            toast.error("Failed to update bookmark");
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] });
        },
    });

    const deletePostMutation = useMutation({
        mutationFn: async (postId: string) => {
            if (!user) throw new Error("Not authenticated");
            const { error } = await supabase
                .from("posts")
                .delete()
                .eq("id", postId)
                .eq("user_id", user.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            toast.success("Post deleted");
        },
    });

    return {
        toggleLike: (postId: string, currentlyLiked: boolean) =>
            toggleLikeMutation.mutate({ postId, currentlyLiked }),
        toggleBookmark: (postId: string, currentlyBookmarked: boolean) =>
            toggleBookmarkMutation.mutate({ postId, currentlyBookmarked }),
        deletePost: (postId: string) => deletePostMutation.mutate(postId),
    };
}
