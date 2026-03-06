import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getNow } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageCircle, FileCode2, ShieldAlert, Trash2, Ban, Undo2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface AdminStats {
  usersTotal: number;
  postsLast24h: number;
  commentsLast24h: number;
}

interface ModerationPost {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    display_name: string;
  } | null;
}

interface ModerationUser {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  banned_until: string | null;
  ban_reason: string | null;
}

const AdminPage = () => {
  const queryClient = useQueryClient();
  const [blockContent, setBlockContent] = useState(true);
  const [blockSocial, setBlockSocial] = useState(true);
  const [blockMessages, setBlockMessages] = useState(true);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const now = getNow();
      const sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [{ count: postsCount }, { count: commentsCount }, { count: usersCount }] = await Promise.all([
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .gt("created_at", sinceIso),
        supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .gt("created_at", sinceIso),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      return {
        usersTotal: usersCount ?? 0,
        postsLast24h: postsCount ?? 0,
        commentsLast24h: commentsCount ?? 0,
      };
    },
    staleTime: 1000 * 60,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<ModerationPost[]>({
    queryKey: ["admin-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `id, content, created_at, user_id,
           profiles!posts_user_id_fkey ( username, display_name )`,
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data as any[]).map((p) => ({
        id: p.id,
        content: p.content,
        created_at: p.created_at,
        user_id: p.user_id,
        profiles: p.profiles,
      }));
    },
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<ModerationUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, banned_until, ban_reason")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as unknown as ModerationUser[];
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      // 1. Fetch media_url to clean up storage
      const { data: post } = await supabase
        .from("posts")
        .select("media_url")
        .eq("id", postId)
        .single();

      if (post?.media_url && post.media_url.includes('post-media')) {
        try {
          const parts = post.media_url.split('post-media/');
          if (parts.length > 1) {
            const storagePath = parts[1].split(/[?#]/)[0];
            await supabase.storage.from("post-media").remove([storagePath]);
          }
        } catch (err) {
          console.error("Storage cleanup failed:", err);
        }
      }

      // 2. Perform the database deletion
      const { error } = await (supabase as any).rpc("admin_delete_post", {
        p_post_id: postId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post deleted as admin.");
    },
    onError: () => {
      toast.error("Failed to delete post. Make sure your admin SQL migration is applied.");
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (params: { userId: string; minutes: number; reason?: string; scopes: string[] }) => {
      const { error } = await (supabase as any).rpc("admin_ban_user", {
        p_user_id: params.userId,
        p_minutes: params.minutes,
        p_reason: params.reason ?? null,
        p_scopes: params.scopes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User banned.");
    },
    onError: () => {
      toast.error("Failed to ban user. Check that the admin SQL migration ran successfully.");
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any).rpc("admin_unban_user", {
        p_user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User unbanned.");
    },
    onError: () => {
      toast.error("Failed to unban user.");
    },
  });

  const handleBan = (userId: string, minutes: number, label: string) => {
    const scopes: string[] = [];
    if (blockContent) scopes.push("post", "comment");
    if (blockSocial) scopes.push("social");
    if (blockMessages) scopes.push("message");

    if (scopes.length === 0) {
      toast.error("Select at least one action to block before banning.");
      return;
    }

    banUserMutation.mutate({ userId, minutes, reason: label, scopes });
  };

  const isBanned = (user: ModerationUser) => {
    if (!user.banned_until) return false;
    return new Date(user.banned_until) > getNow();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>genjutsu — Admin</title>
      </Helmet>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Admin dashboard</h1>
            <p className="text-sm text-muted-foreground">
              High-level overview and moderation controls. Changes here are enforced on the backend.
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <span className="text-muted-foreground">...</span> : stats?.usersTotal ?? 0}
              </div>
              <CardDescription>All profiles created.</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Posts (24h)</CardTitle>
              <FileCode2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <span className="text-muted-foreground">...</span> : stats?.postsLast24h ?? 0}
              </div>
              <CardDescription>Ephemeral posts created in the last 24 hours.</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comments (24h)</CardTitle>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <span className="text-muted-foreground">...</span> : stats?.commentsLast24h ?? 0}
              </div>
              <CardDescription>New comments in the last 24 hours.</CardDescription>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  Recent posts
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>Last 50 posts. Deletions happen via secure admin RPC.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {postsLoading ? (
                <p className="text-xs text-muted-foreground py-4">Loading posts…</p>
              ) : posts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No posts found.</p>
              ) : (
                <div className="mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead className="w-[120px]">Created</TableHead>
                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posts.map((post) => (
                        <TableRow key={post.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">
                                {post.profiles?.display_name ?? "Unknown user"}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                @{post.profiles?.username ?? "unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs max-w-[260px] line-clamp-3">{post.content}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(post.created_at).toLocaleString()}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => deletePostMutation.mutate(post.id)}
                              disabled={deletePostMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Users & bans
                    <Ban className="h-4 w-4 text-muted-foreground" />
                  </CardTitle>
                  <CardDescription>
                    Ban spammers temporarily. Banned users cannot post or comment while active.
                  </CardDescription>
                </div>
              </div>
              <Input
                placeholder="Filter by username or display name…"
                className="h-8 text-xs"
                onChange={(e) => {
                  const value = e.target.value.toLowerCase();
                  queryClient.setQueryData<ModerationUser[]>(["admin-users"], (old = []) =>
                    old.map((u) => ({
                      ...u, _matchesFilter: !value
                        || u.username.toLowerCase().includes(value)
                        || u.display_name.toLowerCase().includes(value),
                    } as any)),
                  );
                }}
              />
              <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={blockContent}
                    onChange={(e) => setBlockContent(e.target.checked)}
                    className="h-3 w-3 rounded border border-border bg-background"
                  />
                  <span>Block posts & comments</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={blockSocial}
                    onChange={(e) => setBlockSocial(e.target.checked)}
                    className="h-3 w-3 rounded border border-border bg-background"
                  />
                  <span>Block likes / bookmarks / follows</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={blockMessages}
                    onChange={(e) => setBlockMessages(e.target.checked)}
                    className="h-3 w-3 rounded border border-border bg-background"
                  />
                  <span>Block whispers</span>
                </label>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {usersLoading ? (
                <p className="text-xs text-muted-foreground py-4">Loading users…</p>
              ) : users.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No users found.</p>
              ) : (
                <div className="mt-2 max-h-[420px] overflow-y-auto pr-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[170px] text-right">Ban controls</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter((u: any) => u._matchesFilter ?? true)
                        .map((user) => {
                          const banned = isBanned(user);
                          return (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{user.display_name}</span>
                                  <span className="text-[11px] text-muted-foreground">@{user.username}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {banned ? (
                                  <div className="flex flex-col">
                                    <span className="text-[11px] text-destructive font-medium">Banned</span>
                                    <span className="text-[10px] text-muted-foreground">
                                      until {new Date(user.banned_until as string).toLocaleString()}
                                    </span>
                                    {user.ban_reason && (
                                      <span className="text-[10px] text-muted-foreground line-clamp-1">
                                        reason: {user.ban_reason}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-emerald-500 font-medium">Active</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                {banned ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => unbanUserMutation.mutate(user.user_id)}
                                    disabled={unbanUserMutation.isPending}
                                  >
                                    <Undo2 className="h-3 w-3 mr-1" />
                                    Unban
                                  </Button>
                                ) : (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => handleBan(user.user_id, 60, "1h")}
                                      disabled={banUserMutation.isPending}
                                    >
                                      1h
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => handleBan(user.user_id, 60 * 24, "24h")}
                                      disabled={banUserMutation.isPending}
                                    >
                                      24h
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-7 px-2 text-[11px]"
                                      onClick={() => handleBan(user.user_id, 60 * 24 * 7, "7d")}
                                      disabled={banUserMutation.isPending}
                                    >
                                      7d
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AdminPage;

