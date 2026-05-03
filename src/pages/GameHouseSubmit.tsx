import { useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Code } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";

export default function GameHouseSubmit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [htmlCode, setHtmlCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be logged in to submit a game.");
      return;
    }

    if (!title.trim() || !description.trim() || !htmlCode.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Generate unique file path
      const fileId = crypto.randomUUID();
      const storagePath = `${user.id}/${fileId}.html`;

      // 2. Upload HTML to Storage
      const htmlBlob = new Blob([htmlCode], { type: "text/html" });
      const { error: uploadError } = await supabase.storage
        .from("game-house")
        .upload(storagePath, htmlBlob, {
          contentType: "text/html",
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. Insert Database Record
      const { error: dbError } = await supabase
        .from("game_house")
        .insert({
          title: title.trim(),
          description: description.trim(),
          html_storage_path: storagePath,
          submitted_by: user.id,
          status: 'pending'
        });

      if (dbError) throw dbError;

      // 4. Notify admins (fire and forget)
      void (supabase as any).rpc("notify_admins_new_game", { p_actor_id: user.id });

      toast.success("Game submitted successfully! It is now waiting for admin approval.");
      navigate("/game-house");
    } catch (err: any) {
      console.error("Submission error:", err);
      toast.error(err.message || "Failed to submit game.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Helmet>
        <title>Submit Game — genjutsu</title>
      </Helmet>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/game-house")}
          className="text-muted-foreground hover:text-foreground -ml-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Arcade
        </Button>

        <header className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase italic">
            Submit <span className="text-primary italic">Game</span>
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Paste your raw HTML, CSS, and JS code below. Your game will be reviewed before appearing in the arcade.
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
                <p className="text-[10px] font-bold text-muted-foreground uppercase pt-1">
                  Ensure all CSS and JS are embedded directly within the HTML file. External scripts may be blocked by the sandbox.
                </p>
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
                    Uploading...
                  </>
                ) : (
                  "Submit to Admins"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </main>
    </div>
  );
}
