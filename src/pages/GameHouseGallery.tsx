import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Download,
  Gamepad2,
  Heart,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ModeToggle } from "@/components/ModeToggle";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface GameHouseItem {
  id: string;
  title: string;
  description: string;
  play_count: number;
  likes_count: number;
  comments_count: number;
  user_liked: boolean;
  created_at: string;
  submitted_by: string;
  html_storage_path: string;
  draft_data?: {
    title: string;
    description: string;
    html_storage_path: string;
  } | null;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  } | null;
}

interface GameHouseComment {
  id: string;
  game_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
    avatar_url?: string;
  } | null;
}

export default function GameHouseGallery() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [gameToDelete, setGameToDelete] = useState<{ id: string; storagePath: string; draftStoragePath?: string } | null>(null);
  const [downloadingGameId, setDownloadingGameId] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const gameQueryKey = useMemo(() => ["game_house_approved", user?.id ?? "guest"], [user?.id]);

  const { data: games, isLoading } = useQuery({
    queryKey: gameQueryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_house")
        .select(`
          id, title, description, play_count, created_at, submitted_by, html_storage_path, draft_data,
          profiles!game_house_submitted_by_fkey(username, display_name, avatar_url)
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = (data as unknown as Omit<GameHouseItem, "likes_count" | "comments_count" | "user_liked">[]) || [];
      if (rows.length === 0) return [] as GameHouseItem[];

      const gameIds = rows.map((game) => game.id);
      const [{ data: likesData }, { data: commentsData }] = await Promise.all([
        supabase.from("game_house_likes").select("game_id, user_id").in("game_id", gameIds),
        supabase.from("game_house_comments").select("game_id").in("game_id", gameIds),
      ]);

      const likesCountMap: Record<string, number> = {};
      const commentsCountMap: Record<string, number> = {};
      const likedSet = new Set<string>();

      (likesData || []).forEach((like: any) => {
        likesCountMap[like.game_id] = (likesCountMap[like.game_id] || 0) + 1;
        if (user?.id && like.user_id === user.id) {
          likedSet.add(like.game_id);
        }
      });

      (commentsData || []).forEach((comment: any) => {
        commentsCountMap[comment.game_id] = (commentsCountMap[comment.game_id] || 0) + 1;
      });

      return rows.map((game) => ({
        ...game,
        likes_count: likesCountMap[game.id] || 0,
        comments_count: commentsCountMap[game.id] || 0,
        user_liked: likedSet.has(game.id),
      })) as GameHouseItem[];
    },
  });

  const activeGame = useMemo(
    () => games?.find((game) => game.id === activeGameId) || null,
    [games, activeGameId],
  );

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["game_house_comments", activeGameId],
    enabled: !!activeGameId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_house_comments")
        .select(`
          id, game_id, user_id, content, created_at,
          profiles!game_house_comments_user_id_fkey(username, display_name, avatar_url)
        `)
        .eq("game_id", activeGameId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as GameHouseComment[];
    },
  });

  useEffect(() => {
    if (!games || games.length === 0) return;

    const gameParam = searchParams.get("game");
    const openParam = searchParams.get("open");
    if (openParam !== "comments" || !gameParam) return;

    const targetGame = games.find((game) => game.id === gameParam);
    if (!targetGame) {
      const next = new URLSearchParams(searchParams);
      next.delete("game");
      next.delete("open");
      setSearchParams(next, { replace: true });
      return;
    }

    setActiveGameId(targetGame.id);
    setCommentsOpen(true);
  }, [games, searchParams, setSearchParams]);

  const setCommentDeepLink = (gameId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (gameId) {
      next.set("game", gameId);
      next.set("open", "comments");
    } else {
      next.delete("game");
      next.delete("open");
    }
    setSearchParams(next, { replace: true });
  };

  const openCommentsSheet = (gameId: string) => {
    setActiveGameId(gameId);
    setCommentsOpen(true);
    setCommentDeepLink(gameId);
  };

  const closeCommentsSheet = () => {
    setCommentsOpen(false);
    setActiveGameId(null);
    setCommentText("");
    setCommentDeepLink(null);
  };

  const handleDelete = async (gameId: string, storagePath: string, draftStoragePath?: string) => {
    try {
      const filesToDelete = [storagePath].filter(Boolean);
      if (draftStoragePath) filesToDelete.push(draftStoragePath);

      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage.from("game-house").remove(filesToDelete);
        if (storageError) console.error("Failed to delete storage files:", storageError);
      }

      const { error: dbError } = await supabase.from("game_house").delete().eq("id", gameId);
      if (dbError) throw dbError;

      toast.success("Game deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["game_house_approved"] });
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete game.");
    }
  };

  const handleDownloadGame = async (game: GameHouseItem) => {
    try {
      setDownloadingGameId(game.id);
      const { data, error } = await supabase.storage.from("game-house").download(game.html_storage_path);
      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${game.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "game"}.html`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Download started!");
    } catch (err: any) {
      console.error("Download failed:", err);
      toast.error("Failed to download the game.");
    } finally {
      setDownloadingGameId(null);
    }
  };

  const handleToggleLike = async (game: GameHouseItem) => {
    if (!user) {
      toast.error("Please sign in to like games");
      return;
    }

    const currentlyLiked = game.user_liked;
    const previousGames = queryClient.getQueryData<GameHouseItem[]>(gameQueryKey);

    queryClient.setQueryData<GameHouseItem[]>(gameQueryKey, (old) =>
      (old || []).map((item) =>
        item.id === game.id
          ? {
              ...item,
              user_liked: !currentlyLiked,
              likes_count: currentlyLiked ? Math.max(0, item.likes_count - 1) : item.likes_count + 1,
            }
          : item,
      ),
    );

    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("game_house_likes")
          .delete()
          .eq("game_id", game.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("game_house_likes").insert({
          game_id: game.id,
          user_id: user.id,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      queryClient.setQueryData(gameQueryKey, previousGames);
      const message = err?.message || "Failed to update like.";
      if (message.includes("permission") || message.includes("row-level")) {
        toast.error("You cannot like this game right now.");
      } else {
        toast.error(message);
      }
    }
  };

  const handleSubmitComment = async () => {
    if (!activeGameId) return;

    if (!user) {
      toast.error("Please sign in to comment");
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed || submittingComment) return;

    setSubmittingComment(true);
    try {
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("create_game_comment", {
        p_game_id: activeGameId,
        p_content: trimmed,
        p_idempotency_key: crypto.randomUUID(),
      });

      if (rpcError) throw rpcError;

      const result = rpcResult as any;
      if (result?.error === "cooldown_active") {
        toast.error(`Please wait ${result.retry_after}s before commenting again.`);
        return;
      }
      if (result?.error === "banned") {
        if (result.ban_permanent) {
          toast.error("You are permanently banned from commenting.");
        } else if (result.banned_until) {
          toast.error(`You are banned from commenting until ${new Date(result.banned_until).toLocaleString()}.`);
        } else {
          toast.error("You are currently banned from commenting.");
        }
        return;
      }
      if (result?.error) {
        throw new Error(result.message || "Failed to add comment");
      }

      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["game_house_comments", activeGameId] });
      queryClient.invalidateQueries({ queryKey: ["game_house_approved"] });
      toast.success("Comment posted!");
    } catch (err: any) {
      toast.error(err?.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || deletingCommentId) return;

    setDeletingCommentId(commentId);
    try {
      const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)("delete_game_comment", {
        p_comment_id: commentId,
      });

      if (rpcError) throw rpcError;

      const result = rpcResult as any;
      if (result?.error) {
        throw new Error(result.message || "Failed to delete comment");
      }

      queryClient.invalidateQueries({ queryKey: ["game_house_comments", activeGameId] });
      queryClient.invalidateQueries({ queryKey: ["game_house_approved"] });
      toast.success("Comment deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete comment");
    } finally {
      setDeletingCommentId(null);
    }
  };

  const filteredGames = games?.filter((game) => {
    const query = searchQuery.toLowerCase();
    const creatorName = game.profiles?.display_name?.toLowerCase() || "";
    const creatorUsername = game.profiles?.username?.toLowerCase() || "";

    return (
      game.title.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query) ||
      creatorName.includes(query) ||
      creatorUsername.includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 animate-in fade-in zoom-in-95">
      <Helmet>
        <title>Game House — genjutsu</title>
      </Helmet>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground gum-btn px-2.5 sm:px-3 py-1.5 border border-border bg-background hover:bg-secondary rounded-[3px] transition-all w-fit shadow-[2px_2px_0_theme(colors.border)] active:translate-y-[2px] active:shadow-none"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <ModeToggle />
        </div>
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border pb-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase italic flex items-center gap-3">
              <Gamepad2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              Game <span className="text-primary italic">House</span>
            </h1>
            <p className="text-muted-foreground font-medium text-sm max-w-xl">
              Community-crafted HTML games. Built by developers, played by everyone.
            </p>
          </div>
          <Button
            onClick={() => navigate("/game-house/submit")}
            className="gum-btn bg-primary text-primary-foreground font-bold rounded-[3px] shadow-[4px_4px_0px_rgba(244,63,94,0.2)] hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4 mr-2" />
            Submit Game
          </Button>
        </header>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search Games, Creator"
              className="pl-9 gum-border bg-card rounded-[3px] h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <FrogLoader size={24} />
          </div>
        ) : !games || games.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-[3px] bg-secondary/10">
            <Gamepad2 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-black uppercase tracking-tight mb-2">The Arcade is Empty</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
              No approved games are currently available. Be the first to submit a game to the Game House!
            </p>
            {user && (
              <Button onClick={() => navigate("/game-house/submit")} variant="outline" className="gum-border rounded-[3px]">
                Start Building
              </Button>
            )}
          </div>
        ) : filteredGames?.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-border rounded-[3px] bg-secondary/10">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-black uppercase tracking-tight mb-2">No Matches Found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames?.map((game) => (
              <Card key={game.id} className="rounded-[3px] gum-border bg-card hover:border-primary/50 transition-colors flex flex-col overflow-hidden group">
                <CardHeader className="pb-3 border-b border-border bg-secondary/10 relative">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-black uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors pr-6">
                        {game.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest mt-2">
                        <Avatar className="w-6 h-6 border border-border">
                          <AvatarImage src={game.profiles?.avatar_url || ""} />
                          <AvatarFallback className="bg-secondary/50 text-[8px]">
                            {game.profiles?.display_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span>{game.profiles?.display_name || "Unknown"}</span>
                          {game.profiles?.username && (
                            <span className="lowercase text-muted-foreground/80">@{game.profiles.username}</span>
                          )}
                        </div>
                      </CardDescription>
                    </div>

                    {user?.id === game.submitted_by && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-3 right-3 text-muted-foreground hover:text-foreground p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] gum-border rounded-[3px]">
                          <DropdownMenuItem onClick={() => navigate(`/game-house/edit/${game.id}`)} className="cursor-pointer">
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit Game</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setGameToDelete({ id: game.id, storagePath: game.html_storage_path, draftStoragePath: game.draft_data?.html_storage_path })}
                            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col justify-between gap-4 bg-background">
                  <p className="text-sm text-muted-foreground line-clamp-3">{game.description}</p>

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Button
                      onClick={() => handleToggleLike(game)}
                      size="sm"
                      variant="ghost"
                      className={`rounded-[3px] px-2 h-8 text-xs font-bold ${game.user_liked ? "text-rose-500" : "text-muted-foreground"}`}
                    >
                      <Heart className={`w-3.5 h-3.5 mr-1 ${game.user_liked ? "fill-current" : ""}`} />
                      {game.likes_count}
                    </Button>
                    <Button
                      onClick={() => openCommentsSheet(game.id)}
                      size="sm"
                      variant="ghost"
                      className="rounded-[3px] px-2 h-8 text-xs font-bold text-muted-foreground"
                    >
                      <MessageSquare className="w-3.5 h-3.5 mr-1" />
                      {game.comments_count}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
                      <div>
                        <span className="text-foreground">{game.play_count}</span> plays
                      </div>
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest opacity-80">
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(game.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleDownloadGame(game)}
                        size="sm"
                        variant="ghost"
                        className="rounded-[3px] px-2"
                        title="Download Source Code"
                        disabled={downloadingGameId === game.id}
                      >
                        {downloadingGameId === game.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Download className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        onClick={() => navigate(`/game-house/play/${game.id}`)}
                        size="sm"
                        className="bg-primary text-primary-foreground font-black uppercase text-[10px] rounded-[3px] tracking-wider hover:bg-primary/90"
                      >
                        <Play className="w-3 h-3 mr-1.5 fill-current" />
                        Play
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!gameToDelete} onOpenChange={(open) => !open && setGameToDelete(null)}>
          <AlertDialogContent className="gum-border rounded-[3px] bg-background">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-black uppercase tracking-tight text-foreground">Delete Game?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your game from the arcade and remove the source code from our servers.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="gum-btn rounded-[3px]">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (gameToDelete) handleDelete(gameToDelete.id, gameToDelete.storagePath, gameToDelete.draftStoragePath);
                  setGameToDelete(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gum-btn rounded-[3px]"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet open={commentsOpen} onOpenChange={(open) => (open ? setCommentsOpen(true) : closeCommentsSheet())}>
          <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
            <SheetHeader className="p-4 sm:p-5 border-b border-border text-left">
              <SheetTitle className="text-base font-black uppercase tracking-tight">{activeGame?.title || "Game Comments"}</SheetTitle>
              <SheetDescription className="text-xs">Echoes from players in Game House.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <FrogLoader size={20} />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-[3px]">
                  No comments yet. Start the conversation.
                </div>
              ) : (
                comments.map((comment) => {
                  const canDelete = !!user && (
                    comment.user_id === user.id ||
                    activeGame?.submitted_by === user.id ||
                    isAdmin
                  );

                  return (
                    <div key={comment.id} className="border border-border rounded-[3px] p-3 bg-secondary/10">
                      <div className="flex items-start gap-3">
                        <Avatar className="w-7 h-7 border border-border mt-0.5">
                          <AvatarImage src={comment.profiles?.avatar_url || ""} />
                          <AvatarFallback className="text-[9px]">
                            {comment.profiles?.display_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{comment.profiles?.display_name || "Unknown"}</p>
                              <p className="text-[10px] text-muted-foreground">
                                @{comment.profiles?.username || "unknown"} • {formatDistanceToNow(new Date(comment.created_at))} ago
                              </p>
                            </div>
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-[10px] text-destructive"
                                disabled={deletingCommentId === comment.id}
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                {deletingCommentId === comment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Delete"}
                              </Button>
                            )}
                          </div>
                          <p className="mt-2 text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-border p-4 space-y-2">
              <Textarea
                placeholder={user ? "Write a comment..." : "Sign in to comment"}
                value={commentText}
                disabled={!user || submittingComment}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[90px] bg-background rounded-[3px]"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={submittingComment || (!!user && !commentText.trim())}
                  className="rounded-[3px] font-bold"
                >
                  {submittingComment ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {user ? "Post" : "Sign in to Comment"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </main>
    </div>
  );
}
