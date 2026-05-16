import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Ban,
  Brush,
  Eraser,
  HeartHandshake,
  Loader2,
  MessageSquareText,
  Radar,
  RefreshCcw,
  Send,
  ShieldCheck,
  Signal,
  Sparkles,
  Tags,
  UserRoundX,
  UsersRound,
  Zap,
} from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
import {
  STRANGER_INTERESTS,
  StrangerMatchMode,
  StrangerSearchOptions,
  useStrangerMatch,
} from "./useStrangerMatch";
import { MessageList } from "./MessageList";

const connectionCopy: Record<string, { label: string; className: string }> = {
  initialized: { label: "Warming up", className: "bg-yellow-500" },
  connecting: { label: "Connecting", className: "bg-yellow-500 animate-pulse" },
  connected: { label: "Realtime live", className: "bg-green-500 animate-pulse" },
  disconnected: { label: "Reconnecting", className: "bg-yellow-500 animate-pulse" },
  suspended: { label: "Unstable", className: "bg-orange-500 animate-pulse" },
  failed: { label: "Offline", className: "bg-destructive" },
  closed: { label: "Closed", className: "bg-muted-foreground" },
};

const interestLabel = (id: string) => STRANGER_INTERESTS.find((interest) => interest.id === id)?.label || id;

export const StrangerChat = () => {
  const {
    status,
    messages,
    sendMessage,
    startSearch,
    stopSearch,
    skip,
    reportAndSkip,
    clearMessages,
    strangerName,
    onlineCount,
    isStrangerTyping,
    sendTypingIndicator,
    connectionState,
    searchHint,
    peerInterests,
    currentOptions,
    blockedCount,
    maxMessageLength,
  } = useStrangerMatch();

  const [text, setText] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["javascript", "react"]);
  const [matchMode, setMatchMode] = useState<StrangerMatchMode>("shared");
  const [composerNotice, setComposerNotice] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connection = connectionCopy[connectionState] || connectionCopy.initialized;
  const selectedInterestNames = useMemo(() => selectedInterests.map(interestLabel).join(", "), [selectedInterests]);
  const peerInterestNames = useMemo(() => peerInterests.map(interestLabel), [peerInterests]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingIndicator(false);
    };
  }, [sendTypingIndicator]);

  const toggleInterest = (id: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(id)) return prev.filter((interest) => interest !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  const beginSearch = () => {
    const options: StrangerSearchOptions = {
      interests: selectedInterests,
      matchMode,
    };
    void startSearch(options);
  };

  const handleInputChange = (value: string) => {
    const next = value.slice(0, maxMessageLength);
    setText(next);

    if (status === "matched") {
      sendTypingIndicator(next.trim().length > 0);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 1800);
    }
  };

  const handleSend = () => {
    if (!text.trim() || status !== "matched") return;
    const result = sendMessage(text);

    if (result.ok) {
      setText("");
      setComposerNotice("");
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingIndicator(false);
      return;
    }

    if (result.reason === "cooldown") {
      setComposerNotice("Slow down a second — anti-spam guard is active.");
      window.setTimeout(() => setComposerNotice(""), 1600);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex border-2 border-border flex-col flex-1 w-full bg-background gum-card overflow-hidden shadow-[4px_4px_0px_hsl(var(--border))] mb-4 lg:mb-0">
      <div className="flex flex-col gap-3 border-b-2 border-border bg-secondary/30 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-3.5 h-3.5 mt-1 rounded-full border-2 border-background shadow-sm shrink-0 ${status === 'matched' ? 'bg-green-500 animate-pulse' : status === 'searching' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
            <div className="min-w-0">
              <h2 className="font-black tracking-tighter truncate text-sm sm:text-lg whitespace-nowrap overflow-hidden leading-tight">
                {status === "idle" ? "Stranger Lobby" : status === "searching" ? "Searching the anonymous lobby" : `Chatting with ${strangerName}`}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] sm:text-xs text-muted-foreground font-bold">
                <span className="inline-flex items-center gap-1">
                  <UsersRound size={13} /> {onlineCount} {onlineCount === 1 ? "coder" : "coders"} online
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${connection.className}`} /> {connection.label}
                </span>
                {blockedCount > 0 && <span className="inline-flex items-center gap-1"><Ban size={13} /> {blockedCount} avoided this session</span>}
              </div>
            </div>
          </div>

          {status !== "idle" && (
            <button
              onClick={() => void stopSearch()}
              className="gum-btn shrink-0 bg-background text-destructive border-destructive/50 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-black hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px] sm:text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-[3px] border border-border bg-background/70 px-2 py-1">
            <ShieldCheck size={13} /> Text only
          </span>
          <span className="inline-flex items-center gap-1 rounded-[3px] border border-border bg-background/70 px-2 py-1">
            <Zap size={13} /> Ephemeral
          </span>
          <span className="inline-flex items-center gap-1 rounded-[3px] border border-border bg-background/70 px-2 py-1">
            <Signal size={13} /> Ably realtime
          </span>
          {status === "matched" && peerInterestNames.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-[3px] border border-primary/50 bg-primary/10 text-foreground px-2 py-1">
              <Tags size={13} /> Stranger likes {peerInterestNames.join(", ")}
            </span>
          )}
        </div>
      </div>

      {status === "idle" && messages.length === 0 ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_28%),radial-gradient(circle_at_bottom_right,hsl(var(--secondary)/0.65),transparent_28%)] p-3 sm:p-5">
          <div className="grid h-full min-h-[560px] gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <section className="flex flex-col justify-center rounded-[3px] gum-border bg-background/85 p-5 sm:p-7 shadow-[4px_4px_0_hsl(var(--border))]">
              <div className="inline-flex w-fit items-center gap-2 rounded-[3px] gum-border bg-primary/10 px-3 py-1.5 text-xs font-black text-primary mb-5">
                <Sparkles size={14} /> Anonymous dev roulette
              </div>
              <h3 className="text-2xl sm:text-4xl font-black tracking-tighter leading-tight mb-3">
                Meet a random stranger. Keep it text. Keep it weirdly useful.
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mb-6">
                Pick interests, choose how strict matching should be, then jump into an ephemeral Ably-powered chat. No profile, no camera, no Supabase chat history.
              </p>

              <div className="grid gap-3 sm:grid-cols-3 mb-6">
                {[
                  { icon: ShieldCheck, title: "Anonymous", copy: "Your Genjutsu profile is not shared." },
                  { icon: MessageSquareText, title: "Text only", copy: "No audio, files, video, or camera." },
                  { icon: RefreshCcw, title: "Skip fast", copy: "Avoid and rematch in this session." },
                ].map((item) => (
                  <div key={item.title} className="rounded-[3px] gum-border bg-secondary/30 p-3 text-left">
                    <item.icon size={18} className="mb-2 text-primary" />
                    <p className="text-xs font-black uppercase tracking-tight">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{item.copy}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={beginSearch}
                disabled={connectionState === "failed" || connectionState === "closed"}
                className="gum-btn group w-full sm:w-fit bg-primary text-primary-foreground font-black px-6 py-3.5 rounded-[3px] shadow-[4px_4px_0px_hsl(var(--border))] disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 hover:translate-x-0.5 transition-transform"
              >
                <span className="inline-flex items-center gap-2">
                  <Radar size={18} className="group-hover:animate-spin" /> Start Searching
                </span>
              </button>
            </section>

            <aside className="rounded-[3px] gum-border bg-background/90 p-4 sm:p-5 shadow-[4px_4px_0_hsl(var(--border))] flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-black tracking-tight flex items-center gap-2"><Tags size={18} /> Interests</h3>
                    <p className="text-[11px] text-muted-foreground font-bold">Pick up to 5. Shared mode prefers overlap.</p>
                  </div>
                  <span className="text-[10px] font-black rounded-[3px] gum-border bg-secondary px-2 py-1">{selectedInterests.length}/5</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STRANGER_INTERESTS.map((interest) => {
                    const active = selectedInterests.includes(interest.id);
                    return (
                      <button
                        key={interest.id}
                        onClick={() => toggleInterest(interest.id)}
                        aria-pressed={active}
                        className={`rounded-[3px] border-2 px-2.5 py-1.5 text-xs font-black transition-all ${active ? "border-primary bg-primary text-primary-foreground shadow-[2px_2px_0_hsl(var(--border))]" : "border-border bg-secondary/40 text-foreground hover:bg-secondary"}`}
                      >
                        <span className="mr-1">{interest.emoji}</span>{interest.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[3px] gum-border bg-secondary/20 p-3">
                <h3 className="font-black tracking-tight flex items-center gap-2 mb-3"><HeartHandshake size={18} /> Match mode</h3>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "shared", label: "Shared", copy: "Prefer same tags" },
                    { id: "random", label: "Random", copy: "Anyone online" },
                  ] as { id: StrangerMatchMode; label: string; copy: string }[]).map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setMatchMode(mode.id)}
                      aria-pressed={matchMode === mode.id}
                      className={`rounded-[3px] gum-border p-3 text-left transition-all ${matchMode === mode.id ? "bg-primary text-primary-foreground shadow-[3px_3px_0_hsl(var(--border))]" : "bg-background hover:bg-secondary"}`}
                    >
                      <span className="block text-sm font-black">{mode.label}</span>
                      <span className="block text-[10px] font-bold opacity-75 mt-1">{mode.copy}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[3px] gum-border bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                <p className="font-black text-foreground mb-1 flex items-center gap-2"><Brush size={15} /> Current setup</p>
                <p>{matchMode === "shared" ? "Shared-interest first" : "Random-first"} matching{selectedInterests.length ? ` with ${selectedInterestNames}.` : " with no selected tags."}</p>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col bg-secondary/5">
          {status === "searching" ? (
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-6 bg-[radial-gradient(circle,hsl(var(--primary)/0.16),transparent_35%)]">
              <div className="relative mb-6">
                <FrogLoader size={56} className="opacity-80" />
                <Loader2 size={92} className="absolute -inset-4 text-primary/20 animate-spin" />
              </div>
              <p className="font-black tracking-widest uppercase text-xs text-primary mb-2">Waiting in lobby...</p>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-2">{searchHint}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed">
                Mode: <span className="font-black text-foreground">{currentOptions.matchMode === "shared" ? "Shared interests" : "Random"}</span>
                {currentOptions.interests.length > 0 && <> · Tags: <span className="font-black text-foreground">{currentOptions.interests.map(interestLabel).join(", ")}</span></>}
              </p>
              <button onClick={() => void stopSearch("Search cancelled.")} className="gum-btn mt-6 bg-background px-5 py-2 text-xs font-black">
                Cancel search
              </button>
            </div>
          ) : (
            <MessageList messages={messages} isStrangerTyping={isStrangerTyping} />
          )}

          {status === "idle" && messages.length > 0 ? (
            <div className="p-3 sm:p-4 bg-background border-t-2 border-border flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground font-bold">Session ended. Start a fresh anonymous chat when you are ready.</p>
              <button
                onClick={beginSearch}
                className="gum-btn bg-primary text-primary-foreground hover:scale-[1.02] active:scale-95 transition-transform font-black px-5 py-2.5 rounded-[3px] shadow-[3px_3px_0_hsl(var(--border))]"
              >
                Find a new Stranger
              </button>
            </div>
          ) : (
            <div className={`bg-background border-t-2 border-border ${status !== "matched" ? "opacity-50 pointer-events-none" : ""}`}>
              {status === "matched" && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold text-muted-foreground">
                  <span>Enter sends · Shift+Enter adds a line · {text.length}/{maxMessageLength}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={clearMessages} className="inline-flex items-center gap-1 hover:text-foreground"><Eraser size={13} /> Clear local</button>
                    <button onClick={() => void reportAndSkip()} className="inline-flex items-center gap-1 hover:text-destructive"><Ban size={13} /> Safety skip</button>
                  </div>
                </div>
              )}
              <div className="p-3 sm:p-4">
                {composerNotice && <p className="mb-2 text-[11px] font-bold text-destructive">{composerNotice}</p>}
                <div className="flex gap-2 relative items-end">
                  <button
                    onClick={() => void skip()}
                    className="flex shrink-0 items-center justify-center gap-1 bg-destructive text-destructive-foreground px-3 sm:px-4 py-3 rounded-[3px] font-black text-sm gum-btn hover:bg-red-600 transition-colors"
                  >
                    <UserRoundX size={16} />
                    <span className="hidden sm:inline">Skip</span>
                  </button>

                  <textarea
                    value={text}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    rows={1}
                    className="flex-1 min-h-[46px] max-h-32 min-w-0 bg-background border-2 border-border rounded-[3px] px-3 sm:px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-mono resize-none"
                    disabled={status !== "matched"}
                  />

                  <button
                    onClick={handleSend}
                    disabled={status !== "matched" || !text.trim()}
                    className="bg-primary shrink-0 text-primary-foreground p-3 px-3 sm:px-5 rounded-[3px] gum-btn disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
