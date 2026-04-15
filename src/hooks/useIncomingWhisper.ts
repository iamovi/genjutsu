import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getNow } from "@/lib/utils";

export interface IncomingWhisper {
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string | null;
  preview: string;
}

/**
 * Listens for new incoming whispers in real-time and surfaces the latest one
 * so the FloatingWhisperBubble can pick it up.
 * Has a 10-second auto-dismiss built in.
 */
export function useIncomingWhisper() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<IncomingWhisper | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sb = supabase as any;

  const dismiss = () => {
    setIncoming(null);
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
  };

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const timer = setTimeout(() => {
      if (cancelled) return;

      const channel = sb
        .channel(`incoming-whisper-bubble-${user.id}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${user.id}`,
          },
          async (payload: any) => {
            const msg = payload.new;

            // Fetch sender profile
            const { data: profile } = await sb
              .from("profiles")
              .select("user_id, username, display_name, avatar_url")
              .eq("user_id", msg.sender_id)
              .single();

            if (!profile || cancelled) return;

            const hasText = typeof msg.content === "string" && msg.content.trim().length > 0;
            const preview = hasText
              ? (msg.content.length > 80 ? msg.content.slice(0, 80) + "..." : msg.content)
              : (msg.media_url ? "sent a photo" : "New whisper");

            setIncoming({
              senderId: profile.user_id,
              senderUsername: profile.username,
              senderDisplayName: profile.display_name,
              senderAvatarUrl: profile.avatar_url,
              preview,
            });

            // Auto-dismiss after 10 seconds
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
            dismissTimer.current = setTimeout(() => setIncoming(null), 10000);
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        channel.unsubscribe();
        sb.removeChannel(channel).catch(() => {});
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
      };
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return { incoming, dismiss };
}
