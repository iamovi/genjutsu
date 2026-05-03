import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getNow } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  MessageCircle,
  FileCode2,
  ShieldAlert,
  Trash2,
  Ban,
  Undo2,
  ShieldCheck,
  Filter,
  AlertTriangle,
  Search,
  LayoutDashboard,
  Clock,
  Gamepad2,
  CheckCircle,
  XCircle,
  Eye
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  ban_permanent?: boolean;
  ban_reason: string | null;
  ban_scopes: string[] | null;
}

interface PendingGame {
  id: string;
  title: string;
  description: string;
  html_storage_path: string;
  submitted_by: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
  };
}

const AdminPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [userSearchText, setUserSearchText] = useState("");
  const [blockContent, setBlockContent] = useState(true);
  const [blockSocial, setBlockSocial] = useState(true);
  const [blockMessages, setBlockMessages] = useState(true);

  // Confirmation State
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmValue, setConfirmValue] = useState("");
  const [banReason, setBanReason] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    type: "delete_post" | "ban_user" | "unban_user";
    targetId: string;
    params?: any;
    label?: string;
  } | null>(null);

  // Queries (Data fetching logic preserved)
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

  const { data: usersData = [], isLoading: usersLoading } = useQuery<ModerationUser[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, banned_until, ban_permanent, ban_reason, ban_scopes")
        .order("created_at", { ascending: false })
        .limit(200);

      // Backward compatibility: old DB schema may not have ban_permanent yet.
      if (error && /ban_permanent/i.test(error.message || "")) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("profiles")
          .select("id, user_id, username, display_name, banned_until, ban_reason, ban_scopes")
          .order("created_at", { ascending: false })
          .limit(200);

        if (fallbackError) throw fallbackError;
        return (fallbackData || []).map((u: any) => ({ ...u, ban_permanent: false })) as ModerationUser[];
      }

      if (error) throw error;
      return (data || []).map((u: any) => ({ ...u, ban_permanent: !!u.ban_permanent })) as ModerationUser[];
    },
  });

  const { data: pendingGames = [], isLoading: gamesLoading } = useQuery<PendingGame[]>({
    queryKey: ["admin-pending-games"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_house")
        .select(`
          id, title, description, html_storage_path, submitted_by, created_at,
          profiles!game_house_submitted_by_fkey ( username, display_name )
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as PendingGame[];
    },
  });

  // Mutations (Logic preserved)
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
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
    onError: () => toast.error("Failed to delete post."),
  });

  const banUserMutation = useMutation({
    mutationFn: async (params: { userId: string; minutes: number; reason?: string; scopes: string[]; permanent?: boolean }) => {
      const payload: Record<string, any> = {
        p_user_id: params.userId,
        p_minutes: params.minutes,
        p_reason: params.reason ?? null,
        p_scopes: params.scopes,
      };
      if (params.permanent) {
        payload.p_permanent = true;
      }

      const { error } = await (supabase as any).rpc("admin_ban_user", payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User banned.");
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      if (msg.includes("admin_ban_user") && msg.includes("does not exist")) {
        toast.error("Permanent ban requires the latest DB migration. Run migration and try again.");
        return;
      }
      toast.error("Failed to ban user.");
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
    onError: () => toast.error("Failed to unban user."),
  });

  const approveGameMutation = useMutation({
    mutationFn: async (game: PendingGame) => {
      const { error } = await supabase
        .from("game_house")
        .update({ status: "approved" })
        .eq("id", game.id);
      if (error) throw error;

      if (user) {
        // Send notification to the user with proper error handling
        try {
          const { error: notifyError } = await (supabase as any).from("notifications").insert({
            user_id: game.submitted_by,
            actor_id: user.id,
            type: "game_approved",
            post_id: null,
            comment_id: null
          });
          if (notifyError) {
            console.error("Failed to send approval notification:", notifyError);
          }
        } catch (err) {
          console.error("Error sending approval notification:", err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-games"] });
      toast.success("Game approved and is now live!");
    },
    onError: () => toast.error("Failed to approve game."),
  });

  const rejectGameMutation = useMutation({
    mutationFn: async (game: PendingGame) => {
      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from("game-house")
        .remove([game.html_storage_path]);
      
      if (storageError) console.error("Storage cleanup failed:", storageError);

      // Delete the record
      const { error } = await supabase
        .from("game_house")
        .delete()
        .eq("id", game.id);
      
      if (error) throw error;

      if (user) {
        // Send notification to the user with proper error handling
        try {
          const { error: notifyError } = await (supabase as any).from("notifications").insert({
            user_id: game.submitted_by,
            actor_id: user.id,
            type: "game_rejected",
            post_id: null,
            comment_id: null
          });
          if (notifyError) {
            console.error("Failed to send rejection notification:", notifyError);
          }
        } catch (err) {
          console.error("Error sending rejection notification:", err);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pending-games"] });
      toast.success("Game rejected and deleted.");
    },
    onError: () => toast.error("Failed to reject game."),
  });

  // Confirmation Handlers
  const triggerDeleteConfirm = (postId: string) => {
    setPendingAction({ type: "delete_post", targetId: postId });
    setConfirmValue("");
    setBanReason("");
    setConfirmOpen(true);
  };

  const triggerBanConfirm = (userId: string, minutes: number, label: string, permanent = false) => {
    const scopes: string[] = [];
    if (blockContent) scopes.push("post", "comment");
    if (blockSocial) scopes.push("social");
    if (blockMessages) scopes.push("message");

    if (scopes.length === 0) {
      toast.error("Select at least one action to block before banning.");
      return;
    }

    setPendingAction({
      type: "ban_user",
      targetId: userId,
      params: { minutes, scopes, permanent },
      label
    });
    setConfirmValue("");
    setBanReason("");
    setConfirmOpen(true);
  };

  const triggerUnbanConfirm = (userId: string) => {
    setPendingAction({ type: "unban_user", targetId: userId });
    setConfirmValue("");
    setBanReason("");
    setConfirmOpen(true);
  };

  const executeConfirmedAction = () => {
    if (confirmValue !== "CONFIRM") return;
    if (!pendingAction) return;
    if (pendingAction.type === "ban_user" && !banReason.trim()) {
      toast.error("Please write a ban reason before banning.");
      return;
    }

    switch (pendingAction.type) {
      case "delete_post":
        deletePostMutation.mutate(pendingAction.targetId);
        break;
      case "ban_user":
        banUserMutation.mutate({
          userId: pendingAction.targetId,
          minutes: pendingAction.params.minutes,
          reason: banReason.trim(),
          scopes: pendingAction.params.scopes,
          permanent: pendingAction.params.permanent
        });
        break;
      case "unban_user":
        unbanUserMutation.mutate(pendingAction.targetId);
        break;
    }

    setConfirmOpen(false);
    setPendingAction(null);
    setConfirmValue("");
    setBanReason("");
  };

  const isBanned = (user: ModerationUser) => {
    if (user.ban_permanent) return true;
    if (!user.banned_until) return false;
    return new Date(user.banned_until) > getNow();
  };

  // Filtered lists
  const filteredAllUsers = useMemo(() => {
    const text = userSearchText.toLowerCase();
    return usersData.filter(u =>
      !text ||
      u.username.toLowerCase().includes(text) ||
      u.display_name.toLowerCase().includes(text)
    );
  }, [usersData, userSearchText]);

  const bannedUsers = useMemo(() => {
    return usersData.filter(u => isBanned(u));
  }, [usersData]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Helmet>
        <title>genjutsu — Admin</title>
      </Helmet>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 sm:space-y-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-8">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase italic">
              Moderation <span className="text-primary italic">Command</span>
            </h1>
            <p className="text-muted-foreground font-medium text-sm">
              Secured administrative oversight and behavioral control.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-secondary/30 p-1 rounded-sm border border-border backdrop-blur-md">
            <div className="px-3 py-1 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Server Live</span>
            </div>
          </div>
        </header>

        {/* Action Confirmation Dialog */}
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            setConfirmOpen(open);
            if (!open) {
              setPendingAction(null);
              setConfirmValue("");
              setBanReason("");
            }
          }}
        >
          <DialogContent className="rounded-none border-border bg-background backdrop-blur-xl border-l-4 border-l-primary gap-6 p-6 sm:p-8">
            <DialogTitle className="sr-only">Edit User</DialogTitle>
            <DialogDescription className="sr-only">Admin tool to modify user profile details and status.</DialogDescription>
            <DialogHeader className="space-y-4">
              <div className="bg-primary/20 p-4 w-fit border-2 border-primary/40 shadow-[0_0_20px_rgba(244,63,94,0.15)] mb-2">
                <ShieldAlert className="w-8 h-8 text-primary" strokeWidth={2.5} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight italic">Authorization Required</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase text-muted-foreground">
                  Executing protocol: <span className="text-primary font-black underline decoration-primary/30">{pendingAction?.type.replace(/_/g, ' ')}</span>
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-[11px] font-bold leading-relaxed uppercase italic text-muted-foreground">
                This action is significant and will be logged. Type <span className="text-primary font-black underline">CONFIRM</span> to bypass security locks.
              </p>
              {pendingAction?.type === "ban_user" && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-widest text-primary">Ban Reason</label>
                  <Textarea
                    id="ban-reason"
                    name="ban-reason"
                    autoComplete="off"
                    className="rounded-none bg-background border-border min-h-20 text-[11px] font-medium placeholder:opacity-40 focus:border-primary/50"
                    placeholder="Write why this user is being banned..."
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    maxLength={300}
                  />
                  <p className="text-[9px] uppercase font-bold text-muted-foreground">
                    This reason is shown to the user while the ban is active.
                  </p>
                </div>
              )}
              <Input
                id="admin-confirm"
                name="admin-confirm"
                autoComplete="off"
                className="rounded-none bg-background border-border h-11 text-center font-black tracking-[0.2em] uppercase text-primary placeholder:opacity-20 translate-x-[2px] focus:border-primary/50"
                placeholder="TYPE HERE"
                value={confirmValue}
                onChange={(e) => setConfirmValue(e.target.value)}
              />
            </div>

            <DialogFooter className="flex sm:flex-row gap-2 mt-4">
              <Button
                variant="outline"
                className="rounded-none h-11 flex-1 uppercase font-black text-[10px] border-border hover:bg-secondary/10 transition-all"
                onClick={() => {
                  setConfirmOpen(false);
                  setPendingAction(null);
                  setConfirmValue("");
                  setBanReason("");
                }}
              >
                Abort
              </Button>
              <Button
                variant="destructive"
                className="rounded-none h-11 flex-1 uppercase font-black text-[10px] italic shadow-[4px_4px_0px_rgba(244,63,94,0.2)] disabled:opacity-30 disabled:grayscale transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                disabled={confirmValue !== "CONFIRM" || (pendingAction?.type === "ban_user" && !banReason.trim())}
                onClick={executeConfirmedAction}
              >
                Execute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stats Grid */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <motion.div variants={itemVariants}>
            <Card className="rounded-none border-border bg-secondary/20 hover:bg-secondary/40 transition-all duration-300 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <Users className="w-24 h-24" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="uppercase text-[10px] font-black tracking-[0.2em] text-primary/70">Population</CardDescription>
                <CardTitle className="text-4xl font-black italic">{statsLoading ? "—" : stats?.usersTotal ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-bold">Total registered citizens.</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="rounded-none border-border bg-secondary/20 hover:bg-secondary/40 transition-all duration-300 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <FileCode2 className="w-24 h-24" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="uppercase text-[10px] font-black tracking-[0.2em] text-emerald-500/70">Intelligence</CardDescription>
                <CardTitle className="text-4xl font-black italic">{statsLoading ? "—" : stats?.postsLast24h ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-bold">New posts in circulation (24h).</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="rounded-none border-border bg-secondary/20 hover:bg-secondary/40 transition-all duration-300 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity translate-x-4 -translate-y-4">
                <MessageCircle className="w-24 h-24" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="uppercase text-[10px] font-black tracking-[0.2em] text-blue-500/70">Engagement</CardDescription>
                <CardTitle className="text-4xl font-black italic">{statsLoading ? "—" : stats?.commentsLast24h ?? 0}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-bold">Conversational volume (24h).</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.section>

        <Tabs defaultValue="posts" className="w-full space-y-6 sm:space-y-8">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="bg-transparent border-b border-border w-full min-w-max justify-start gap-4 sm:gap-8 rounded-none h-auto p-0 pb-2">
              <TabsTrigger value="posts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2 h-auto text-[10px] sm:text-[11px] uppercase font-black tracking-widest transition-all hover:text-primary">
                <LayoutDashboard className="w-3 h-3 mr-2" />
                Live Posts
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2 h-auto text-[10px] sm:text-[11px] uppercase font-black tracking-widest transition-all hover:text-primary">
                <Users className="w-3 h-3 mr-2" />
                All Users
              </TabsTrigger>
              <TabsTrigger value="banned" className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive data-[state=active]:bg-transparent px-2 pb-2 h-auto text-[10px] sm:text-[11px] uppercase font-black tracking-widest transition-all hover:text-destructive">
                <Ban className="w-3 h-3 mr-2" />
                Banned Users
                {bannedUsers.length > 0 && <Badge variant="destructive" className="ml-2 rounded-none px-1 py-0 h-3.5 sm:h-4 text-[8px] sm:text-[9px] min-w-4 flex items-center justify-center">{bannedUsers.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="game-house" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-2 h-auto text-[10px] sm:text-[11px] uppercase font-black tracking-widest transition-all hover:text-primary">
                <Gamepad2 className="w-3 h-3 mr-2" />
                Game House
                {pendingGames.length > 0 && <Badge className="ml-2 rounded-none px-1 py-0 h-3.5 sm:h-4 text-[8px] sm:text-[9px] min-w-4 flex items-center justify-center">{pendingGames.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Posts Tab */}
          <TabsContent value="posts" className="space-y-4 m-0 transition-all">
            <Card className="rounded-none border-border bg-secondary/10 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4">
                <div className="space-y-0.5">
                  <CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2">
                    Operational Feed
                  </CardTitle>
                  <CardDescription className="text-[10px] font-medium">Real-time surveillance of user-generated content.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-border">
                  {postsLoading ? (
                    <div className="p-10 text-center text-[10px] uppercase font-black opacity-30 italic">Retrieving stream...</div>
                  ) : posts.length === 0 ? (
                    <div className="p-10 text-center text-[10px] uppercase font-black opacity-30 italic">No activity detected.</div>
                  ) : (
                    posts.map((post) => (
                      <div key={post.id} className="p-4 space-y-3 bg-secondary/10">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase italic tracking-tight">{post.profiles?.display_name ?? "Missing Entity"}</span>
                            <span className="text-[10px] text-primary font-bold">@{post.profiles?.username ?? "null"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60">
                            <Clock className="w-2.5 h-2.5 text-primary" />
                            {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed opacity-80 line-clamp-3">{post.content}</p>
                        <div className="flex justify-end pt-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 w-full rounded-none text-[10px] font-black uppercase italic"
                            onClick={() => triggerDeleteConfirm(post.id)}
                            disabled={deletePostMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Eviscerate
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/20 border-b border-border">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Entity</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Payload</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Timestamp</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postsLoading ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="text-center py-10 text-[11px] uppercase font-bold opacity-50 italic">Retrieving stream...</TableCell></TableRow>
                      ) : posts.length === 0 ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="text-center py-10 text-[11px] uppercase font-bold opacity-50 italic">No activity detected.</TableCell></TableRow>
                      ) : (
                        posts.map((post) => (
                          <TableRow key={post.id} className="border-border group transition-colors hover:bg-secondary/10">
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase italic tracking-tight">
                                  {post.profiles?.display_name ?? "Missing Entity"}
                                </span>
                                <span className="text-[10px] text-primary font-bold">
                                  @{post.profiles?.username ?? "null"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <p className="text-[11px] font-medium leading-relaxed max-w-md line-clamp-2 opacity-80">{post.content}</p>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                <Clock className="w-3 h-3 text-primary" />
                                {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-4">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 rounded-none text-[10px] font-black uppercase italic opacity-0 group-hover:opacity-100 transition-all hover:scale-105"
                                onClick={() => triggerDeleteConfirm(post.id)}
                                disabled={deletePostMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Eviscerate
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6 m-0 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Controls Column */}
              <div className="w-full lg:w-80 space-y-6 shrink-0">
                <Card className="rounded-none border-border bg-secondary/5">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-[11px] uppercase font-black tracking-widest flex items-center gap-2">
                      Targeting Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        id="user-search"
                        name="user-search"
                        placeholder="Search Identification..."
                        className="pl-9 h-10 rounded-none bg-background/50 border-border text-[11px] font-bold"
                        value={userSearchText}
                        onChange={(e) => setUserSearchText(e.target.value)}
                      />
                    </div>

                    <div className="space-y-4 pt-2">
                      <h4 className="text-[10px] uppercase font-black tracking-widest text-primary">Ban Scope Definition</h4>
                      <div className="space-y-3">
                        {[
                          { id: "content", label: "Posts & Comments", state: blockContent, setter: setBlockContent },
                          { id: "social", label: "Interactions (Likes/Follow)", state: blockSocial, setter: setBlockSocial },
                          { id: "messages", label: "Private Whispers", state: blockMessages, setter: setBlockMessages },
                        ].map((scope) => (
                          <label key={scope.id} className="flex items-center justify-between p-3 border border-border bg-background/30 cursor-pointer hover:bg-background/50 transition-colors">
                            <span className="text-[10px] font-bold uppercase tracking-tight text-foreground">{scope.label}</span>
                            <div
                              onClick={() => scope.setter(!scope.state)}
                              className={`w-4 h-4 border-2 flex items-center justify-center transition-all ${scope.state ? 'bg-primary border-primary' : 'border-white/10'}`}
                            >
                              {scope.state && <div className="w-1.5 h-1.5 bg-background font-black" />}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border bg-primary/5 p-4 border-l-4 border-l-primary">
                  <div className="flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest leading-tight text-foreground">Admin Protocol</p>
                      <p className="text-[9px] font-bold leading-tight uppercase italic text-muted-foreground/80">
                        Sanctions applied here are absolute. Actions are logged and permanent.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Users List Column */}
              <div className="flex-1 min-w-0">
                <Card className="rounded-none border-border bg-secondary/5 overflow-hidden">
                  <CardContent className="p-0">
                    {/* Mobile Card View */}
                    <div className="md:hidden divide-y divide-border">
                      {usersLoading ? (
                        <div className="p-10 text-center text-[10px] uppercase font-black opacity-30 italic">Decrypting registry...</div>
                      ) : filteredAllUsers.length === 0 ? (
                        <div className="p-10 text-center text-[10px] uppercase font-black opacity-30 italic">No matches found.</div>
                      ) : (
                        filteredAllUsers.map((user) => {
                          const banned = isBanned(user);
                          return (
                            <div key={user.id} className="p-4 space-y-4 bg-secondary/5">
                              <div className="flex justify-between items-center">
                                <div className="flex flex-col">
                                  <span className="text-xs font-black uppercase italic">{user.display_name}</span>
                                  <span className="text-[10px] font-bold text-muted-foreground">@{user.username}</span>
                                </div>
                                {banned ? (
                                  <Badge variant="destructive" className="rounded-none text-[8px] font-black uppercase italic px-1.5 py-0">Restricted</Badge>
                                ) : (
                                  <Badge className="rounded-none bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] font-black uppercase italic px-1.5 py-0">Compliant</Badge>
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                {banned ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-full rounded-none border-emerald-500/50 text-emerald-500 text-[10px] font-black uppercase italic hover:bg-emerald-500 hover:text-white transition-all shadow-[2px_2px_0px_rgba(16,185,129,0.1)] active:shadow-none"
                                    onClick={() => triggerUnbanConfirm(user.user_id)}
                                    disabled={unbanUserMutation.isPending}
                                  >
                                    <Undo2 className="h-3.5 w-3.5 mr-2" />
                                    Amnesty
                                  </Button>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2">
                                    {[
                                      { label: "1h", minutes: 60 },
                                      { label: "24h", minutes: 1440 },
                                      { label: "7d", minutes: 10080 },
                                      { label: "perm", minutes: 0, permanent: true },
                                    ].map((duration) => (
                                      <Button
                                        key={duration.label}
                                        size="sm"
                                        variant={duration.label === "7d" || duration.permanent ? "destructive" : "outline"}
                                        className={`h-8 rounded-none text-[9px] font-black uppercase border-border active:scale-95 transition-all ${duration.label !== "7d" && !duration.permanent ? 'active:bg-primary/20 active:text-primary active:border-primary/50' : ''}`}
                                        onClick={() => triggerBanConfirm(
                                          user.user_id,
                                          duration.minutes,
                                          duration.label,
                                          Boolean(duration.permanent)
                                        )}
                                        disabled={banUserMutation.isPending}
                                      >
                                        {duration.label}
                                      </Button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader className="bg-secondary/20 border-b border-border">
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Subject</TableHead>
                            <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Status</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Ban Application</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersLoading ? (
                            <TableRow className="hover:bg-transparent"><TableCell colSpan={3} className="text-center py-10 text-[11px] uppercase font-bold opacity-50 italic">Decrypting registry...</TableCell></TableRow>
                          ) : filteredAllUsers.length === 0 ? (
                            <TableRow className="hover:bg-transparent"><TableCell colSpan={3} className="text-center py-10 text-[11px] uppercase font-bold opacity-50 italic">No matches found.</TableCell></TableRow>
                          ) : (
                            filteredAllUsers.map((user) => {
                              const banned = isBanned(user);
                              return (
                                <TableRow key={user.id} className="border-border group hover:bg-secondary/10">
                                  <TableCell className="py-4">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black uppercase italic italic">{user.display_name}</span>
                                      <span className="text-[10px] font-bold text-muted-foreground">@{user.username}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4">
                                    {banned ? (
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-destructive rounded-full" />
                                        <span className="text-[10px] uppercase font-black text-destructive tracking-widest italic">Restricted</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                        <span className="text-[10px] uppercase font-black text-emerald-500 tracking-widest italic">Compliant</span>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right py-4">
                                    {banned ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 rounded-none border-emerald-500/30 text-emerald-500 text-[10px] font-black uppercase italic hover:bg-emerald-500 hover:text-white transition-all"
                                        onClick={() => triggerUnbanConfirm(user.user_id)}
                                        disabled={unbanUserMutation.isPending}
                                      >
                                        <Undo2 className="h-3.5 w-3.5 mr-1" />
                                        Amnesty
                                      </Button>
                                    ) : (
                                      <div className="flex justify-end gap-1.5">
                                        {[
                                          { label: "1h", minutes: 60 },
                                          { label: "24h", minutes: 1440 },
                                          { label: "7d", minutes: 10080 },
                                          { label: "perm", minutes: 0, permanent: true },
                                        ].map((duration) => (
                                          <Button
                                            key={duration.label}
                                            size="sm"
                                            variant={duration.label === "7d" || duration.permanent ? "destructive" : "outline"}
                                            className={`h-8 rounded-none text-[9px] font-black uppercase border-border hover:scale-105 transition-transform ${duration.label !== '7d' && !duration.permanent ? 'hover:bg-primary/20 hover:text-primary hover:border-primary/50' : ''}`}
                                            onClick={() => triggerBanConfirm(
                                              user.user_id,
                                              duration.minutes,
                                              duration.label,
                                              Boolean(duration.permanent)
                                            )}
                                            disabled={banUserMutation.isPending}
                                          >
                                            {duration.label}
                                          </Button>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>


          {/* Banned Tab */}
          <TabsContent value="banned" className="space-y-4 m-0 animate-in slide-in-from-bottom-2 duration-500">
            <Card className="rounded-none border-destructive/20 bg-destructive/[0.03] overflow-hidden">
              <CardHeader className="border-b border-destructive/10 py-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 text-destructive">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm uppercase font-black tracking-[0.2em] text-destructive">Sanction Registry</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase opacity-60 italic">Active correctional measures across the infrastructure.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-destructive/10">
                  {bannedUsers.length === 0 ? (
                    <div className="p-16 text-center text-[10px] uppercase font-black opacity-30 tracking-widest italic">Zero active sanctions.</div>
                  ) : (
                    bannedUsers.map((user) => (
                      <div key={user.id} className="p-4 space-y-4 bg-destructive/[0.03]">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase italic tracking-tight">{user.display_name}</span>
                            <span className="text-[10px] text-destructive/70 font-bold">@{user.username}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {user.ban_permanent ? (
                              <Badge className="rounded-none bg-destructive text-white text-[8px] uppercase font-black px-2 py-0 border-none">Permanent</Badge>
                            ) : (
                              <>
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase text-destructive italic">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(user.banned_until as string).toLocaleDateString()}
                                </div>
                                <span className="text-[8px] font-bold opacity-40 uppercase leading-none">
                                  {new Date(user.banned_until as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {(user.ban_scopes && user.ban_scopes.length > 0) ? (
                            user.ban_scopes.map((s) => (
                              <Badge key={s} className="rounded-none bg-destructive/10 text-destructive border-destructive/20 text-[8px] uppercase font-bold px-2 py-0">
                                {s}
                              </Badge>
                            ))
                          ) : (
                            <Badge className="rounded-none bg-destructive text-white text-[8px] uppercase font-black px-2 py-0 border-none">GLOBAL</Badge>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full h-9 rounded-none text-[10px] font-black uppercase italic shadow-[4px_4px_0px_rgba(244,63,94,0.1)] active:shadow-none transition-all"
                          onClick={() => unbanUserMutation.mutate(user.user_id)}
                          disabled={unbanUserMutation.isPending}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-2" />
                          Pardon Subject
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-destructive/10">
                      <TableRow className="border-destructive/10 hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-destructive py-3 h-auto">Subject</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-destructive py-3 h-auto">Expiration</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-destructive py-3 h-auto">Blocked Scopes</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-black tracking-widest text-destructive py-3 h-auto">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bannedUsers.length === 0 ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="text-center py-16 text-[11px] uppercase font-black opacity-30 tracking-widest italic">Zero active sanctions detected.</TableCell></TableRow>
                      ) : (
                        bannedUsers.map((user) => (
                          <TableRow key={user.id} className="border-destructive/10 group hover:bg-destructive/[0.05] transition-colors">
                            <TableCell className="py-5">
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase italic">{user.display_name}</span>
                                <span className="text-[10px] text-destructive/70 font-bold">@{user.username}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-5">
                              {user.ban_permanent ? (
                                <Badge className="rounded-none bg-destructive text-white text-[8px] uppercase font-black px-2 py-0 border-none">Permanent</Badge>
                              ) : (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-destructive/80 italic">
                                    <Clock className="w-3 h-3" />
                                    {new Date(user.banned_until as string).toLocaleDateString()}
                                  </div>
                                  <div className="text-[9px] font-bold opacity-50 uppercase leading-none">
                                    {new Date(user.banned_until as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="py-5">
                              <div className="flex flex-wrap gap-1">
                                {(user.ban_scopes && user.ban_scopes.length > 0) ? (
                                  user.ban_scopes.map((s) => (
                                    <Badge key={s} className="rounded-none bg-destructive/10 text-destructive border-destructive/20 text-[8px] uppercase font-bold px-2 py-0">
                                      {s}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge className="rounded-none bg-destructive text-white text-[8px] uppercase font-black px-2 py-0 border-none">GLOBAL</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-5 text-destructive/80">
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-9 px-4 rounded-none text-[10px] font-black uppercase italic transition-all hover:scale-105 active:scale-95 shadow-[4px_4px_0px_rgba(244,63,94,0.2)] hover:shadow-none"
                                onClick={() => unbanUserMutation.mutate(user.user_id)}
                                disabled={unbanUserMutation.isPending}
                              >
                                <Undo2 className="h-3.5 w-3.5 mr-2" />
                                Pardon Subject
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          {/* Game House Tab */}
          <TabsContent value="game-house" className="space-y-4 m-0 transition-all animate-in fade-in duration-500">
            <Card className="rounded-none border-border bg-secondary/10 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border py-4">
                <div className="space-y-0.5">
                  <CardTitle className="text-xs uppercase font-black tracking-widest flex items-center gap-2">
                    Pending Game Submissions
                  </CardTitle>
                  <CardDescription className="text-[10px] font-medium">Review and moderate community games before they go live.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile View */}
                <div className="md:hidden divide-y divide-border">
                  {gamesLoading ? (
                    <div className="p-10 text-center text-[10px] uppercase font-black opacity-30 italic">Retrieving stream...</div>
                  ) : pendingGames.length === 0 ? (
                    <div className="p-10 text-center text-[10px] uppercase font-black opacity-30 italic">No pending games.</div>
                  ) : (
                    pendingGames.map((game) => (
                      <div key={game.id} className="p-4 space-y-3 bg-secondary/10">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase italic tracking-tight line-clamp-1">{game.title}</span>
                            <span className="text-[10px] text-primary font-bold">@{game.profiles?.username}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold opacity-60">
                            <Clock className="w-2.5 h-2.5 text-primary" />
                            {new Date(game.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <p className="text-[11px] font-medium leading-relaxed opacity-80 line-clamp-2">{game.description}</p>
                        <div className="flex flex-col gap-2 pt-2">
                          <Button size="sm" variant="outline" className="h-8 rounded-[3px] text-[10px] font-black uppercase italic" onClick={() => window.open(`/game-house/play/${game.id}`, '_blank')}>
                            <Eye className="w-3.5 h-3.5 mr-2" /> Preview
                          </Button>
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[3px] text-[10px] font-black uppercase italic" onClick={() => approveGameMutation.mutate(game)} disabled={approveGameMutation.isPending}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 h-8 rounded-[3px] text-[10px] font-black uppercase italic" onClick={() => { if(window.confirm('Reject and delete game?')) rejectGameMutation.mutate(game) }} disabled={rejectGameMutation.isPending}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Desktop View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-secondary/20 border-b border-border">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Game Info</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Submitter</TableHead>
                        <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Date</TableHead>
                        <TableHead className="text-right text-[10px] uppercase font-black tracking-widest text-muted-foreground py-3 h-auto">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gamesLoading ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="text-center py-10 text-[11px] uppercase font-bold opacity-50 italic">Retrieving stream...</TableCell></TableRow>
                      ) : pendingGames.length === 0 ? (
                        <TableRow className="hover:bg-transparent"><TableCell colSpan={4} className="text-center py-10 text-[11px] uppercase font-bold opacity-50 italic">No pending games.</TableCell></TableRow>
                      ) : (
                        pendingGames.map((game) => (
                          <TableRow key={game.id} className="border-border group transition-colors hover:bg-secondary/10">
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase italic tracking-tight">{game.title}</span>
                                <span className="text-[10px] font-medium leading-relaxed max-w-xs line-clamp-1 opacity-80">{game.description}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase italic tracking-tight">{game.profiles?.display_name}</span>
                                <span className="text-[10px] text-primary font-bold">@{game.profiles?.username}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                                <Clock className="w-3 h-3 text-primary" />
                                {new Date(game.created_at).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button size="sm" variant="outline" className="h-8 rounded-[3px] text-[10px] font-black uppercase italic transition-all hover:bg-primary/10" onClick={() => window.open(`/game-house/play/${game.id}`, '_blank')}>
                                  <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                                </Button>
                                <Button size="sm" className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[3px] text-[10px] font-black uppercase italic transition-all" onClick={() => approveGameMutation.mutate(game)} disabled={approveGameMutation.isPending}>
                                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
                                </Button>
                                <Button size="sm" variant="destructive" className="h-8 rounded-[3px] text-[10px] font-black uppercase italic transition-all" onClick={() => { if(window.confirm('Reject and delete game?')) rejectGameMutation.mutate(game) }} disabled={rejectGameMutation.isPending}>
                                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminPage;
