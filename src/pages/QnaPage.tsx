import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Send, ArrowLeft, CheckCircle, MessageCircle } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { motion, AnimatePresence } from "framer-motion";

export default function QnaPage() {
  const { username } = useParams<{ username: string }>();
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Fetch target profile by username
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["qna-profile", username],
    queryFn: async () => {
      if (!username) throw new Error("No username");
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, bio")
        .eq("username", username.toLowerCase())
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!username,
  });

  const handleSubmit = async () => {
    const trimmed = question.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > 500) {
      setError("Question must be under 500 characters.");
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      const { error: insertError } = await (supabase as any)
        .from("qna_questions")
        .insert({
          target_user_id: profile.user_id,
          question_text: trimmed,
        });
      if (insertError) throw insertError;

      setSubmitted(true);
      setQuestion("");
    } catch (err: any) {
      console.error("QnA submit error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <FrogLoader size={24} />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-black uppercase tracking-tight mb-2">User Not Found</h2>
        <p className="text-muted-foreground text-sm mb-6">This user doesn't exist or their profile is unavailable.</p>
        <Link to="/" className="gum-btn bg-primary text-primary-foreground text-sm">
          Go Home
        </Link>
      </div>
    );
  }

  const initials = profile.display_name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Ask @{profile.username} — genjutsu</title>
        <meta name="description" content={`Send an anonymous question to ${profile.display_name || profile.username} on genjutsu.`} />
        <meta property="og:title" content={`Ask @${profile.username} anonymously — genjutsu`} />
        <meta property="og:description" content={`Send an anonymous question to ${profile.display_name || profile.username} on genjutsu. They won't know who asked.`} />
        <meta property="og:image" content={profile.avatar_url || "/fav.jpg"} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`Ask @${profile.username} anonymously — genjutsu`} />
        <meta name="twitter:description" content={`Send an anonymous question to ${profile.display_name || profile.username} on genjutsu.`} />
        <meta name="twitter:image" content={profile.avatar_url || "/fav.jpg"} />
      </Helmet>

      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Back link */}
        <Link
          to={`/u/${profile.username}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 gum-card bg-secondary text-xs font-bold hover:bg-primary hover:text-primary-foreground transition-colors w-fit mb-8"
        >
          <ArrowLeft size={14} />
          View Profile
        </Link>

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="gum-card p-6 text-center mb-6"
        >
          <div className="w-20 h-20 rounded-[3px] gum-border bg-secondary flex items-center justify-center text-2xl font-bold mx-auto mb-4 overflow-hidden">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" loading="lazy" />
            ) : initials}
          </div>
          <h1 className="text-xl font-black tracking-tight">{profile.display_name}</h1>
          <p className="text-muted-foreground text-sm mt-1">@{profile.username}</p>

          <div className="flex items-center justify-center gap-2 mt-4 text-primary">
            <MessageCircle size={18} />
            <span className="text-sm font-bold uppercase tracking-wider">Ask me anything</span>
          </div>
        </motion.div>

        {/* Submit form or success */}
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="gum-card p-8 text-center"
            >
              <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-black uppercase tracking-tight mb-2">Question Sent!</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your question has been delivered anonymously to @{profile.username}. They may answer it on their feed.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="gum-btn bg-primary text-primary-foreground text-sm"
              >
                Ask Another Question
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="gum-card p-6"
            >
              <label htmlFor="qna-question" className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Your Question (Anonymous)
              </label>
              <textarea
                id="qna-question"
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Type your question here..."
                className="w-full bg-secondary/40 gum-border p-3 resize-none outline-none text-sm min-h-[120px] rounded-[3px] placeholder:text-muted-foreground"
                maxLength={500}
                rows={4}
              />
              <div className="flex items-center justify-between mt-3">
                <span className={`text-xs font-medium ${question.length > 450 ? "text-destructive" : "text-muted-foreground"}`}>
                  {question.length}/500
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={!question.trim() || submitting}
                  className="gum-btn bg-primary text-primary-foreground text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? <FrogLoader size={14} /> : <Send size={14} />}
                  {submitting ? "Sending..." : "Send Question"}
                </button>
              </div>
              {error && (
                <p className="text-destructive text-xs font-medium mt-2">{error}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground mt-8">
          Questions are submitted anonymously. Be kind. ❤️
        </p>
      </div>
    </div>
  );
}
