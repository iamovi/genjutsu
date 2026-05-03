import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, AlertTriangle } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { toast } from "sonner";

export default function GameHousePlay() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);

  const { data: game, isLoading, isError } = useQuery({
    queryKey: ["game_house_play", id],
    queryFn: async () => {
      if (!id) throw new Error("No game ID provided");
      
      const { data, error } = await supabase
        .from("game_house")
        .select(`
          id, title, description, html_storage_path, status, play_count,
          profiles!game_house_submitted_by_fkey(username, display_name)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    async function loadGameUrl() {
      if (!game || !game.html_storage_path) return;

      try {
        // Increment play count (fire and forget, but log errors)
        supabase.rpc("increment_game_play_count", { p_game_id: game.id }).then(({ error }) => {
          if (error) {
            console.error("Play count increment failed:", error);
          } else {
            queryClient.invalidateQueries({ queryKey: ["game_house_approved"] });
          }
        });

        // Download the file directly as a Blob (works for both public and private buckets)
        const { data: blob, error } = await supabase.storage
          .from("game-house")
          .download(game.html_storage_path);

        if (error) throw error;
        if (blob) {
          let htmlText = await blob.text();
          
          // Inject responsive scaling CSS to prevent canvas cut-offs
          const scaleCSS = `
<style>
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    overflow: hidden !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    background-color: #000 !important;
  }
  canvas {
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
  }
</style>
`;
          if (htmlText.includes('<head>')) {
            htmlText = htmlText.replace('<head>', '<head>' + scaleCSS);
          } else {
            htmlText = scaleCSS + htmlText;
          }

          setIframeHtml(htmlText);
        }
      } catch (err: any) {
        console.error("Failed to load game URL:", err);
        toast.error("Could not load game files.");
      }
    }

    if (game) {
      loadGameUrl();
    }
  }, [game]);

  const toggleFullscreen = () => {
    const iframe = document.getElementById("game-iframe");
    if (iframe) {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if ((iframe as any).webkitRequestFullscreen) {
        (iframe as any).webkitRequestFullscreen();
      } else if ((iframe as any).msRequestFullscreen) {
        (iframe as any).msRequestFullscreen();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <FrogLoader size={48} />
        </div>
      </div>
    );
  }

  if (isError || !game) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-black uppercase tracking-tight mb-2">Game Not Found</h2>
          <p className="text-muted-foreground text-sm mb-6">The requested game does not exist or has been removed.</p>
          <Button onClick={() => navigate("/game-house")} className="gum-btn rounded-[3px]">
            Return to Arcade
          </Button>
        </div>
      </div>
    );
  }

  // If we can read it but it's pending, user must be the author or admin (RLS let them through).
  // We can still let them preview it.

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-500 animate-in fade-in zoom-in-95">
      <Helmet>
        <title>{game.title} — genjutsu</title>
      </Helmet>

      <main className="flex-1 max-w-6xl w-full mx-auto px-0 sm:px-6 py-0 sm:py-6 flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-0 sm:mb-4 bg-background z-10 border-b border-border sm:border-none">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground gum-btn px-2.5 sm:px-3 py-1.5 border border-border bg-background hover:bg-secondary rounded-[3px] transition-all w-fit shadow-[2px_2px_0_theme(colors.border)] active:translate-y-[2px] active:shadow-none"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="text-center flex-1 sm:flex-none">
            <h1 className="text-base sm:text-lg font-black uppercase tracking-tight italic line-clamp-1 pr-1">{game.title}</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
              By @{game.profiles?.username || game.profiles?.display_name || "unknown"}
            </p>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={toggleFullscreen}
            className="gum-border rounded-[3px]"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Fullscreen</span>
          </Button>
        </div>

        <div className="flex-1 w-full bg-black relative border-y sm:border-2 border-border sm:rounded-[3px] gum-shadow-sm overflow-hidden">
          {!iframeHtml ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20 text-white">
              <div className="flex flex-col items-center gap-4">
                <FrogLoader size={48} />
                <p className="text-xs uppercase font-bold tracking-widest animate-pulse">Initializing Environment...</p>
              </div>
            </div>
          ) : (
            <iframe
              id="game-iframe"
              srcDoc={iframeHtml}
              className="absolute inset-0 w-full h-full border-none bg-white"
              title={game.title}
              sandbox="allow-scripts"
              allowFullScreen
            />
          )}
        </div>
        
        {game.status !== 'approved' && (
          <div className="bg-destructive/20 text-destructive text-center p-2 text-xs font-bold uppercase tracking-widest">
            Preview Mode: This game is currently {game.status}.
          </div>
        )}
      </main>
    </div>
  );
}
