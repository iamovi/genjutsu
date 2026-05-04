import { Helmet } from "react-helmet-async";

import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gamepad2, Plus, Play, User as UserIcon, ArrowLeft, Search, Calendar } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ModeToggle";
import { format } from "date-fns";

interface GameHouseItem {
  id: string;
  title: string;
  description: string;
  play_count: number;
  created_at: string;
  profiles: {
    username: string;
    display_name: string;
  };
}

export default function GameHouseGallery() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: games, isLoading } = useQuery({
    queryKey: ["game_house_approved"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("game_house")
        .select(`
          id, title, description, play_count, created_at,
          profiles!game_house_submitted_by_fkey(username, display_name)
        `)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as GameHouseItem[];
    },
  });

  const filteredGames = games?.filter(game => {
    const query = searchQuery.toLowerCase();
    const creatorName = game.profiles?.display_name?.toLowerCase() || "";
    const creatorUsername = game.profiles?.username?.toLowerCase() || "";

    return game.title.toLowerCase().includes(query) ||
      game.description.toLowerCase().includes(query) ||
      creatorName.includes(query) ||
      creatorUsername.includes(query);
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
            <FrogLoader size={48} />
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
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Try adjusting your search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames?.map((game) => (
              <Card key={game.id} className="rounded-[3px] gum-border bg-card hover:border-primary/50 transition-colors flex flex-col overflow-hidden group">
                <CardHeader className="pb-3 border-b border-border bg-secondary/10">
                  <CardTitle className="text-lg font-black uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                    {game.title}
                  </CardTitle>
                  <CardDescription className="flex items-start gap-1.5 text-[10px] font-bold uppercase tracking-widest mt-2">
                    <UserIcon className="w-3 h-3 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <span>{game.profiles?.display_name || "Unknown"}</span>
                      {game.profiles?.username && <span className="lowercase text-muted-foreground/80">@{game.profiles.username}</span>}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col justify-between gap-4 bg-background">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {game.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
                      <div><span className="text-foreground">{game.play_count}</span> plays</div>
                      <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest opacity-80">
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(game.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/game-house/play/${game.id}`)}
                      size="sm"
                      className="bg-primary text-primary-foreground font-black uppercase text-[10px] rounded-[3px] tracking-wider hover:bg-primary/90"
                    >
                      <Play className="w-3 h-3 mr-1.5 fill-current" />
                      Play Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
