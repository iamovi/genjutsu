import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Music, Search, Play, Pause, X, ChevronDown, ChevronUp, SkipForward, Volume2 } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import DataSaverImage from "@/components/DataSaverImage";
import { toast } from "sonner";

export function MusicPlayer() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { requestPlay, notifyStop } = useGlobalAudio();

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    notifyStop("music-player");
  };

  const playTrack = (track: any) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const canPlay = requestPlay("music-player", () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    });

    if (!canPlay) return;

    setCurrentTrack(track);
    const audio = new Audio(track.previewUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    audio.onended = () => {
      // Auto-play next if available
      const currentIndex = results.findIndex(t => t.trackId === track.trackId);
      if (currentIndex !== -1 && currentIndex < results.length - 1) {
        playTrack(results[currentIndex + 1]);
      } else {
        setIsPlaying(false);
        notifyStop("music-player");
      }
    };

    audio.play().catch(() => {
        setIsPlaying(false);
        notifyStop("music-player");
    });
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      notifyStop("music-player");
    } else {
      const canPlay = requestPlay("music-player", () => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      });
      if (canPlay) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const playNext = () => {
      if (!currentTrack) return;
      const currentIndex = results.findIndex(t => t.trackId === currentTrack.trackId);
      if (currentIndex !== -1 && currentIndex < results.length - 1) {
          playTrack(results[currentIndex + 1]);
      } else if (results.length > 0) {
          playTrack(results[0]);
      }
  };

  return (
    <div className="fixed bottom-6 left-6 z-[9999]">
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="gum-card p-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all group relative"
          >
            <Music size={24} className={isPlaying ? "animate-bounce" : ""} />
            {isPlaying && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-foreground"></span>
                </span>
            )}
          </motion.button>
        )}

        {isOpen && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            className="gum-card w-80 bg-card overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="bg-secondary p-3 border-b-2 border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Music size={16} />
                <span className="font-bold text-xs uppercase tracking-widest">Groove Player</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-background/50 rounded-[3px] transition-colors"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-background/50 rounded-[3px] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {isExpanded && (
              <>
                {/* Search Bar */}
                <div className="p-3 border-b-2 border-border bg-background/50">
                  <div className="relative">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search iTunes..."
                      className="w-full bg-background gum-border pl-8 pr-12 py-1.5 text-xs focus:outline-none"
                    />
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 hover:text-primary transition-colors disabled:opacity-50"
                    >
                      {loading ? <FrogLoader size={14} /> : <Search size={14} />}
                    </button>
                  </div>
                </div>

                {/* Results / Empty State */}
                <div className="max-h-48 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {results.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">No tracks loaded</p>
                    </div>
                  ) : (
                    results.map((track) => (
                      <button
                        key={track.trackId}
                        onClick={() => playTrack(track)}
                        className={`w-full flex items-center gap-2 p-1.5 rounded-[3px] transition-colors text-left group ${currentTrack?.trackId === track.trackId ? "bg-primary/10" : "hover:bg-secondary"}`}
                      >
                        <div className="w-8 h-8 shrink-0 gum-border overflow-hidden relative">
                          <DataSaverImage src={track.artworkUrl60} alt="" className="w-full h-full object-cover" />
                          {currentTrack?.trackId === track.trackId && isPlaying && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                <Pause size={12} fill="currentColor" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[11px] font-bold truncate ${currentTrack?.trackId === track.trackId ? "text-primary" : ""}`}>{track.trackName}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{track.artistName}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Player Controls (Always visible when open) */}
            <div className="p-3 bg-secondary/30 border-t-2 border-border">
              {currentTrack && (
                <div className="mb-3 flex items-center gap-3">
                  <div className="w-10 h-10 gum-border shrink-0 overflow-hidden">
                    <DataSaverImage src={currentTrack.artworkUrl100} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate">{currentTrack.trackName}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{currentTrack.artistName}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {/* Progress Bar */}
                <div className="h-1.5 bg-background gum-border overflow-hidden">
                  <motion.div
                    className="h-full bg-primary"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="gum-btn !p-2 bg-primary text-primary-foreground"
                    >
                      {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                    <button
                        onClick={playNext}
                        className="gum-btn !p-2 bg-secondary"
                    >
                      <SkipForward size={16} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Volume2 size={14} />
                    <div className="w-12 h-1 bg-muted rounded-full">
                        <div className="w-2/3 h-full bg-foreground rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
