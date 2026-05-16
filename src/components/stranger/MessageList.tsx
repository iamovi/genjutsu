import { Message } from "./useStrangerMatch";
import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { Bot, ShieldCheck, TriangleAlert } from "lucide-react";

const systemToneClass: Record<NonNullable<Message['tone']>, string> = {
  default: "bg-secondary/80 text-secondary-foreground border-border",
  success: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/40",
  warning: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/40",
  danger: "bg-destructive/15 text-destructive border-destructive/40",
};

export const MessageList = ({ messages, isStrangerTyping }: { messages: Message[], isStrangerTyping?: boolean }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isStrangerTyping]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
        <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center bg-background/60 rounded-[3px] gum-border border-dashed p-6">
          <div className="w-14 h-14 rounded-[3px] gum-border bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-[3px_3px_0_theme(colors.border)]">
            <Bot size={28} />
          </div>
          <p className="font-black tracking-tight text-foreground mb-2">You are now chatting with a random stranger.</p>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-sm leading-relaxed">
            Say hi, ask what they are building, or use the icebreaker. Messages stay in this browser session only.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.10),transparent_32%),radial-gradient(circle_at_bottom_left,hsl(var(--secondary)/0.45),transparent_30%)]">
      {messages.map((msg) => {
        if (msg.sender === "system") {
          const tone = msg.tone || 'default';
          const Icon = tone === 'danger' || tone === 'warning' ? TriangleAlert : ShieldCheck;
          return (
            <div key={msg.id} className="flex justify-center px-2">
              <span className={`inline-flex items-center gap-2 max-w-[92%] border text-[11px] sm:text-xs px-3 py-1.5 rounded-[3px] font-bold shadow-[2px_2px_0_hsl(var(--border))] ${systemToneClass[tone]}`}>
                <Icon size={13} className="shrink-0" />
                <span className="leading-relaxed">{msg.text}</span>
              </span>
            </div>
          );
        }

        const isMe = msg.sender === "me";
        return (
          <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
            <div className="flex items-end gap-2 max-w-[88%] sm:max-w-[78%]">
              {!isMe && (
                <div className="hidden sm:flex w-7 h-7 rounded-[3px] gum-border bg-secondary items-center justify-center text-xs font-black shrink-0">
                  ?
                </div>
              )}
              <div
                className={`p-3 sm:p-3.5 rounded-[3px] text-sm leading-relaxed whitespace-pre-wrap break-words gum-border ${
                  isMe
                    ? "bg-primary text-primary-foreground shadow-[3px_3px_0px_hsl(var(--border))]"
                    : "bg-background text-foreground shadow-[3px_3px_0px_hsl(var(--border)/0.35)]"
                }`}
              >
                {msg.text}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 mx-1 font-mono">
              {isMe ? 'You' : 'Stranger'} · {format(msg.timestamp, "HH:mm")}
            </span>
          </div>
        );
      })}
      {isStrangerTyping && (
        <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-end gap-2 max-w-[85%]">
            <div className="hidden sm:flex w-7 h-7 rounded-[3px] gum-border bg-secondary items-center justify-center text-xs font-black shrink-0">
              ?
            </div>
            <div className="bg-background gum-border text-foreground shadow-[3px_3px_0px_hsl(var(--border)/0.35)] p-3 rounded-[3px] text-sm leading-relaxed flex items-center gap-1.5 h-11 w-16 justify-center">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
};
