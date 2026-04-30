import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCallback } from "react";
import { usePostActions } from "./usePostActions";
import { getNow } from "@/lib/utils";

export interface PostWithProfile {
  id: string;
  content: string;
  code: string | null;
  code_language: string | null;
  media_url: string | null;
  tags: string[];
  created_at: string;
  edited_at: string | null;
  user_id: string;
  views_count: number;
  profiles: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  likes_count: number;
  user_liked: boolean;
  user_bookmarked: boolean;
  comments_count: number;
  is_readme: boolean;
}

const PAGE_SIZE = 10;

export function usePosts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toggleLike, toggleBookmark, deletePost } = usePostActions();

  const fetchPosts = async ({ pageParam = 0 }) => {
    const from = pageParam * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: postsData, error } = await (supabase
      .from("posts")
      .select(`
        id, content, code, code_language, media_url, tags, created_at, edited_at, user_id, is_readme, views_count,
        profiles ( username, display_name, avatar_url )
      `) as any)
      .gt("created_at", new Date(getNow().getTime() - 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!postsData) return [];

    const postIds = (postsData as any[]).map(p => p.id);
    if (postIds.length === 0) return [];

    // Fetch likes counts + user-specific likes in a single query
    const [{ data: likesData }, { data: commentsData }, { data: myBookmarksData }] = await Promise.all([
      supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
      user
        ? supabase.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds)
        : Promise.resolve({ data: [] }),
    ]);

    const likesCounts: Record<string, number> = {};
    const userLikes = new Set<string>();
    (likesData || []).forEach((l: any) => {
      likesCounts[l.post_id] = (likesCounts[l.post_id] || 0) + 1;
      if (user && l.user_id === user.id) userLikes.add(l.post_id);
    });

    const commentsCounts: Record<string, number> = {};
    (commentsData || []).forEach((c: any) => {
      commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
    });

    const userBookmarks = new Set<string>(
      (myBookmarksData || []).map((b: any) => b.post_id)
    );

    return postsData.map((p: any) => ({
      ...p,
      views_count: Number(p.views_count || 0),
      likes_count: likesCounts[p.id] || 0,
      user_liked: userLikes.has(p.id),
      user_bookmarked: userBookmarks.has(p.id),
      comments_count: commentsCounts[p.id] || 0,
    })) as PostWithProfile[];
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["posts", "infinite", user?.id],
    queryFn: fetchPosts,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    staleTime: 60_000,      // Don't re-fetch for 60s — kills the cascade refetch on tab focus
    gcTime: 5 * 60_000,     // Keep pages in memory for 5 min to avoid cold reloads
    refetchOnWindowFocus: false, // Prevent refetch on every tab switch
  });

  const posts = data?.pages.flat() ?? [];

  const createPostMutation = useMutation({
    mutationFn: async ({ content, code, code_language, tags, media_url, is_readme, idempotency_key }: { content: string, code: string, code_language?: string, tags: string[], media_url?: string, is_readme: boolean, idempotency_key: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.rpc("create_post", {
        p_content: content,
        p_code: code || "",
        p_code_language: code_language || null,
        p_tags: tags,
        p_media_url: media_url || "",
        p_is_readme: is_readme,
        p_idempotency_key: idempotency_key,
      });
      if (error) throw error;

      const result = data as any;
      if (result?.error === "cooldown_active") {
        throw new Error(`COOLDOWN:${result.retry_after}`);
      }
      if (result?.error === "banned") {
        if (result?.ban_permanent) {
          throw new Error("BANNED_POST_PERMANENT");
        }
        throw new Error(`BANNED_POST:${result.banned_until || ""}`);
      }
      if (result?.error) {
        throw new Error(result.message || "Failed to create post");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["trending-tags"] });
      toast.success("Post shared!");
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      if (msg.startsWith("COOLDOWN:")) {
        const seconds = parseInt(msg.split(":")[1], 10);
        toast.error(`Please wait ${seconds}s before posting again.`);
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
      if (msg === "BANNED_POST_PERMANENT") {
        toast.error("You are permanently banned from posting.");
        return;
      }
      toast.error("Your thoughts couldn't be woven into the world. Please try again.");
    }
  });

  return {
    posts,
    loading: status === "pending",
    createPost: useCallback((content: string, code: string, code_language: string = "javascript", tags: string[], media_url?: string, is_readme: boolean = false) => {
      if (!user) {
        toast.error("Please sign in to share a post");
        return;
      }
      const idempotency_key = crypto.randomUUID();
      return createPostMutation.mutateAsync({ content, code, code_language, tags, media_url, is_readme, idempotency_key });
    }, [user, createPostMutation]),
    toggleLike,
    toggleBookmark,
    deletePost,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  };
}
