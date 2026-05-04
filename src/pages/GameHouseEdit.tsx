import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Code } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { useQuery } from "@tanstack/react-query";

export default function GameHouseEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [htmlStoragePath, setHtmlStoragePath] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: game, isLoading, isError } = useQuery({
    queryKey: ["game_house_edit", id],
    queryFn: async () => {
      if (!id) throw new Error("No game ID provided");
      
      const { data, error } = await supabase
        .from("game_house")
        .select(`id, title, description, html_storage_path, submitted_by, draft_data, status`)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!user) {
      toast.error("You must be logged in to edit a game.");
      navigate("/auth");
      return;
    }

    if (game && !isInitialized) {
      if (game.submitted_by !== user.id) {
        toast.error("You are not authorized to edit this game.");
        navigate("/game-house");
        return;
      }

      const draft = game.draft_data as any;
      setTitle(draft?.title || game.title);
      setDescription(draft?.description || game.description);
      const targetStoragePath = draft?.html_storage_path || game.html_storage_path;
      setHtmlStoragePath(targetStoragePath);
      setIsInitialized(true);

      // Fetch the HTML content
      const fetchHtml = async () => {
        try {
          const { data: blob, error } = await supabase.storage
            .from("game-house")
            .download(targetStoragePath);
          
          if (error) throw error;
          if (blob) {
            const text = await blob.text();
            setHtmlCode(text);
          }
        } catch (err) {
          console.error("Failed to load HTML source:", err);
          toast.error("Could not load the game's source code.");
        }
      };

      fetchHtml();
    }
  }, [game, user, navigate, isInitialized]);

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <FrogLoader size={48} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <p className="text-destructive font-bold mb-4">Failed to load game data.</p>
        <Button onClick={() => navigate("/game-house")} variant="outline">Back to Arcade</Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!title.trim() || !description.trim() || !htmlCode.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    // Basic HTML Validation
    const lowerHtml = htmlCode.toLowerCase();
    if (!lowerHtml.includes("<html") || !lowerHtml.includes("</html>")) {
      toast.error("Invalid code: Your game must include proper <html> and </html> tags.");
      return;
    }
    if (!lowerHtml.includes("<body") || !lowerHtml.includes("</body>")) {
      toast.error("Invalid code: Your game must include proper <body> and </body> tags.");
      return;
    }

    setIsSubmitting(true);
    try {
      const isUnapprovedNewSubmission = game?.status === 'pending' && !game?.draft_data;
      const existingDraft = game?.draft_data as any;

      let targetStoragePath = "";
      
      if (isUnapprovedNewSubmission) {
        // Editing a brand new submission that hasn't been approved yet.
        targetStoragePath = game?.html_storage_path;
      } else if (existingDraft?.html_storage_path) {
        // Editing a game that is already pending an edit review (overwrite the draft)
        targetStoragePath = existingDraft.html_storage_path;
      } else {
        // First time editing an approved game (create new draft)
        const draftFileId = crypto.randomUUID();
        targetStoragePath = `${user.id}/drafts/${draftFileId}.html`;
      }

      // 1. Upload HTML to Storage
      const htmlBlob = new Blob([htmlCode], { type: "text/html" });
      const { error: uploadError } = await supabase.storage
        .from("game-house")
        .upload(targetStoragePath, htmlBlob, {
          contentType: "text/html",
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Update Database Record
      let updatePayload: any = {};

      if (isUnapprovedNewSubmission) {
        // Update main columns directly — game stays 'pending'
        updatePayload.title = title.trim();
        updatePayload.description = description.trim();
      } else {
        // Approved game: keep status as 'approved', just set draft_data.
        // The admin panel finds edits by checking draft_data IS NOT NULL.
        // The game stays live in the gallery while the edit is pending.
        updatePayload.draft_data = {
          title: title.trim(),
          description: description.trim(),
          html_storage_path: targetStoragePath
        };
      }

      const { error: dbError } = await supabase
        .from("game_house")
        .update(updatePayload)
        .eq("id", game?.id);

      if (dbError) throw dbError;

      // 3. Notify admins about the edit
      try {
        // You might want a specific 'notify_admins_game_edit' RPC if it exists,
        // but for now we can reuse the new game notification or just skip it if not defined.
        await (supabase as any).rpc("notify_admins_new_game", { p_actor_id: user.id });
      } catch (err) {
        console.error("Error notifying admins:", err);
      }

      toast.success("Game updated successfully! It is now pending admin review.");
      navigate("/game-house");
    } catch (err: any) {
      console.error("Update error:", err);
      toast.error(err.message || "Failed to update game.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-500 animate-in fade-in zoom-in-95">
      <Helmet>
        <title>Edit Game — genjutsu</title>
      </Helmet>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <div className="mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground gum-btn px-2.5 sm:px-3 py-1.5 border border-border bg-background hover:bg-secondary rounded-[3px] transition-all w-fit shadow-[2px_2px_0_theme(colors.border)] active:translate-y-[2px] active:shadow-none"
          >
            <ArrowLeft size={16} />
            <span>Cancel Edit</span>
          </button>
        </div>

        <header className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase italic">
            Edit <span className="text-primary italic">Game</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Modify your game details. Note: Editing an approved game will send it back to the pending queue for review.
          </p>
        </header>

        <Card className="rounded-[3px] gum-border bg-card">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Game Title</Label>
                <Input
                  id="title"
                  placeholder="E.g., Neon Tetris"
                  className="gum-border rounded-[3px] bg-background"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</Label>
                <Textarea
                  id="description"
                  placeholder="How to play, controls, and what it's about..."
                  className="gum-border rounded-[3px] bg-background resize-y"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={250}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="htmlCode" className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Code className="w-3 h-3" />
                    Raw HTML Source
                  </Label>
                </div>
                <Textarea
                  id="htmlCode"
                  placeholder="<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>"
                  className="gum-border rounded-[3px] bg-background font-mono text-xs resize-y min-h-[300px]"
                  value={htmlCode}
                  onChange={(e) => setHtmlCode(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            
            <div className="p-6 pt-0 border-t border-border mt-6 flex justify-end">
              <Button 
                type="submit" 
                disabled={isSubmitting || !user}
                className="gum-btn bg-primary text-primary-foreground font-black uppercase tracking-wider rounded-[3px]"
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 inline-flex items-center"><FrogLoader size={16} /></div>
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
