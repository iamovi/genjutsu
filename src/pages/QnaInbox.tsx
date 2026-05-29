import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { FrogLoader, FullScreenFrogLoader } from "@/components/ui/FrogLoader";
import { Trash2, MessageSquareReply, Inbox, Link as LinkIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface QnaQuestion {
  id: string;
  question_text: string;
  is_answered: boolean;
  created_at: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function QnaInbox() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const { data: questions, isLoading } = useQuery({
    queryKey: ["qna-inbox", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("qna_questions")
        .select("id, question_text, is_answered, created_at")
        .eq("target_user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as QnaQuestion[];
    },
    enabled: !!user,
  });

  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));

    try {
      const { error } = await (supabase as any)
        .from("qna_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["qna-inbox"] });
      toast.success("Question deleted.");
    } catch {
      toast.error("Couldn't delete question.");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAnswer = async (q: QnaQuestion) => {
    // Mark as answered
    await (supabase as any)
      .from("qna_questions")
      .update({ is_answered: true })
      .eq("id", q.id);

    queryClient.invalidateQueries({ queryKey: ["qna-inbox"] });

    // Navigate to home feed with the question pre-filled in the composer
    navigate("/", {
      state: {
        qnaQuestion: q.question_text,
      },
    });
  };

  const handleCopyLink = () => {
    if (!profile?.username) return;
    const url = `${window.location.origin}/qna/${profile.username}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("QnA link copied!");
    }).catch(() => {
      toast.error("Couldn't copy link.");
    });
  };

  if (authLoading) {
    return <FullScreenFrogLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const unanswered = (questions || []).filter((q) => !q.is_answered);
  const answered = (questions || []).filter((q) => q.is_answered);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>QnA Inbox — genjutsu</title>
        <meta name="description" content="View and answer anonymous questions on genjutsu." />
      </Helmet>
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div className="min-w-0 space-y-6">
            {/* Header */}
            <div className="gum-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-[3px]">
                  <Inbox size={22} className="text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-black tracking-tight uppercase">QnA Inbox</h1>
                  <p className="text-xs text-muted-foreground">
                    {unanswered.length} unanswered · {answered.length} answered
                  </p>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="gum-btn bg-secondary text-secondary-foreground text-xs flex items-center gap-2 w-fit"
              >
                <LinkIcon size={14} />
                Copy Your QnA Link
              </button>
            </div>

            {/* Questions list */}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <FrogLoader size={24} />
              </div>
            ) : unanswered.length === 0 && answered.length === 0 ? (
              <div className="gum-card p-8 text-center border-dashed border-2">
                <Inbox size={40} className="text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm font-medium">No questions yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Share your QnA link to start receiving anonymous questions!
                </p>
              </div>
            ) : (
              <>
                {/* Unanswered */}
                {unanswered.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                      Unanswered ({unanswered.length})
                    </h2>
                    <AnimatePresence mode="popLayout">
                      {unanswered.map((q) => (
                        <motion.div
                          key={q.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="gum-card p-5"
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {q.question_text}
                          </p>
                          <div className="flex items-center justify-between mt-4 pt-3 border-t border-secondary">
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {timeAgo(q.created_at)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDelete(q.id)}
                                disabled={deletingIds.has(q.id)}
                                className="gum-btn bg-secondary text-xs flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                                Delete
                              </button>
                              <button
                                onClick={() => handleAnswer(q)}
                                className="gum-btn bg-primary text-primary-foreground text-xs flex items-center gap-1.5"
                              >
                                <MessageSquareReply size={13} />
                                Answer on Feed
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Answered */}
                {answered.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-1">
                      Answered ({answered.length})
                    </h2>
                    {answered.map((q) => (
                      <div key={q.id} className="gum-card p-5 opacity-60">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words line-through decoration-muted-foreground/30">
                          {q.question_text}
                        </p>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-secondary">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {timeAgo(q.created_at)}
                          </span>
                          <button
                            onClick={() => handleDelete(q.id)}
                            disabled={deletingIds.has(q.id)}
                            className="gum-btn bg-secondary text-xs flex items-center gap-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
            <Sidebar />
          </div>
        </div>
      </main>
    </div>
  );
}
