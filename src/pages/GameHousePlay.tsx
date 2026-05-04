import { useEffect, useState, useRef, useCallback } from "react";
import { Helmet } from "react-helmet-async";

import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Maximize2, AlertTriangle, RotateCcw, Pencil } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function GameHousePlay() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDraftPreview = searchParams.get('draft') === 'true';
  const queryClient = useQueryClient();
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const playCountedRef = useRef(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: game, isLoading, isError } = useQuery({
    queryKey: ["game_house_play", id],
    queryFn: async () => {
      if (!id) throw new Error("No game ID provided");
      
      const { data, error } = await supabase
        .from("game_house")
        .select(`
          id, title, description, html_storage_path, status, play_count, submitted_by, draft_data,
          profiles!game_house_submitted_by_fkey(username, display_name, avatar_url)
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

      // Determine which file to load
      const draftPath = game.draft_data?.html_storage_path;
      const fileToLoad = (isDraftPreview && draftPath) ? draftPath : game.html_storage_path;

      try {
        // Increment play count only once per page visit (skip for draft previews)
        if (!playCountedRef.current && !isDraftPreview) {
          playCountedRef.current = true;
          supabase.rpc("increment_game_play_count", { p_game_id: game.id }).then(({ error }) => {
            if (error) {
              console.error("Play count increment failed:", error);
            } else {
              queryClient.invalidateQueries({ queryKey: ["game_house_approved"] });
            }
          });
        }

        // Download the HTML file
        const { data: blob, error } = await supabase.storage
          .from("game-house")
          .download(fileToLoad);

        if (error) throw error;
        if (blob) {
          let htmlText = await blob.text();
          
          // Inject minimal sandbox helper CSS
          // - Resets margin/padding so games fill the frame cleanly
          // - Handles canvas scaling for canvas-based games
          // - Preserves the game's own background, colors, fonts, and layout
          const sandboxCSS = `
<style data-sandbox="genjutsu">
  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }
  /* Canvas games: scale to fit without cropping */
  canvas {
    display: block;
    max-width: 100vw;
    max-height: 100vh;
  }
</style>
`;
          // Inject into <head> if present, otherwise prepend
          if (htmlText.includes('<head>')) {
            htmlText = htmlText.replace('<head>', '<head>' + sandboxCSS);
          } else if (htmlText.includes('<HEAD>')) {
            htmlText = htmlText.replace('<HEAD>', '<HEAD>' + sandboxCSS);
          } else {
            htmlText = sandboxCSS + htmlText;
          }

          setIframeHtml(htmlText);
          setLoadError(false);
        }
      } catch (err: any) {
        console.error("Failed to load game:", err);
        setLoadError(true);
        toast.error("Could not load game files.");
      }
    }

    if (game) {
      loadGameUrl();
    }
  }, [game, queryClient, isDraftPreview]);

  // Auto-focus the iframe after it loads so keyboard input works immediately
  const handleIframeLoad = useCallback(() => {
    setIframeLoaded(true);
    // Focus the iframe so keyboard events (arrow keys, WASD, etc.) go to the game
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  }, []);

  // Reload the game (useful if it crashes or gets stuck)
  const reloadGame = useCallback(() => {
    setIframeLoaded(false);
    setIframeHtml(null);
    setLoadError(false);
    // Re-trigger the effect by invalidating the query
    playCountedRef.current = true; // Don't re-increment play count on reload
    queryClient.invalidateQueries({ queryKey: ["game_house_play", id] });
  }, [id, queryClient]);

  const toggleFullscreen = () => {
    const iframe = iframeRef.current;
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

          <div className="text-center flex-1 sm:flex-none flex flex-col items-center sm:items-start">
            <h1 className="text-base sm:text-lg font-black uppercase tracking-tight italic line-clamp-1 pr-1">{game.title}</h1>
            <div className="flex items-center gap-1.5 justify-center sm:justify-start mt-0.5">
              <Avatar className="w-4 h-4 border border-border">
                <AvatarImage src={game.profiles?.avatar_url || ""} />
                <AvatarFallback className="bg-secondary/50 text-[6px]">
                  {game.profiles?.display_name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                By @{game.profiles?.username || game.profiles?.display_name || "unknown"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {user?.id === game.submitted_by && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate(`/game-house/edit/${game.id}`)}
                className="gum-border rounded-[3px]"
                title="Edit Game"
              >
                <Pencil className="w-4 h-4" />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={reloadGame}
              className="gum-border rounded-[3px]"
              title="Reload Game"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
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
        </div>

        <div
          className="flex-1 w-full relative border-y sm:border-2 border-border sm:rounded-[3px] gum-shadow-sm overflow-hidden"
          style={{ touchAction: "none" }} // Prevent parent page scroll from interfering with in-game touch
        >
          {/* Loading overlay — visible until iframe signals it has loaded */}
          {(!iframeHtml || !iframeLoaded) && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
              <div className="flex flex-col items-center gap-4">
                <FrogLoader size={48} />
                <p className="text-xs uppercase font-bold tracking-widest animate-pulse text-muted-foreground">Initializing Environment...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
              <div className="flex flex-col items-center gap-4 text-center p-4">
                <AlertTriangle className="w-12 h-12 text-destructive" />
                <h3 className="text-sm font-black uppercase tracking-tight">Failed to Load Game</h3>
                <p className="text-xs text-muted-foreground max-w-xs">The game files could not be downloaded. Check your connection and try again.</p>
                <Button onClick={reloadGame} variant="outline" size="sm" className="gum-border rounded-[3px]">
                  <RotateCcw className="w-3 h-3 mr-2" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Game iframe */}
          {iframeHtml && (
            <iframe
              ref={iframeRef}
              id="game-iframe"
              srcDoc={iframeHtml}
              className="absolute inset-0 w-full h-full border-none"
              title={game.title}
              sandbox="allow-scripts allow-same-origin allow-popups"
              allow="autoplay; gamepad"
              allowFullScreen
              onLoad={handleIframeLoad}
            />
          )}
        </div>
        
        {isDraftPreview && game.draft_data && (
          <div className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-center p-2 text-xs font-bold uppercase tracking-widest">
            Draft Preview: You are viewing the pending edit, not the live version.
          </div>
        )}
        {game.status !== 'approved' && (
          <div className="bg-destructive/20 text-destructive text-center p-2 text-xs font-bold uppercase tracking-widest">
            Preview Mode: This game is currently {game.status}.
          </div>
        )}
      </main>
    </div>
  );
}
