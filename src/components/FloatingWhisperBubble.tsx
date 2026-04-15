import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { useIncomingWhisper } from "@/hooks/useIncomingWhisper";
import { useAuth } from "@/hooks/useAuth";

/**
 * FloatingWhisperBubble
 *
 * A Messenger-style floating chat head that appears when a new whisper
 * arrives while the user is browsing any page other than the active chat.
 *
 * - Pops up with an entry animation from the bottom-right
 * - Shows the sender's avatar, name, and a message preview
 * - Clicking anywhere on the card navigates to the whisper chat
 * - Has an X dismiss button
 * - Auto-dismisses after 10 seconds (handled in the hook)
 * - Does NOT appear if the user is already in that specific chat
 */
export function FloatingWhisperBubble() {
  const { user } = useAuth();
  const { incoming, dismiss } = useIncomingWhisper();
  const navigate = useNavigate();
  const location = useLocation();
  const [isExiting, setIsExiting] = useState(false);

  if (!user || !incoming) return null;

  // Don't show bubble anywhere inside whisper inbox/chat routes.
  const isInWhisperInbox =
    /^\/whisper(\/|$)/.test(location.pathname) ||
    /^\/whispers(\/|$)/.test(location.pathname);
  if (isInWhisperInbox) return null;

  const handleOpen = () => {
    setIsExiting(true);
    setTimeout(() => {
      dismiss();
      setIsExiting(false);
      navigate(`/whisper/${incoming.senderUsername}`);
    }, 200);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExiting(true);
    setTimeout(() => {
      dismiss();
      setIsExiting(false);
    }, 200);
  };

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key={`bubble-${incoming.senderId}`}
          initial={{ opacity: 0, y: 60, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.90 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="fixed bottom-6 right-4 z-[9999] max-w-[310px] w-[calc(100vw-2rem)] sm:w-80"
        >
          {/* Card */}
          <div
            onClick={handleOpen}
            className="
              gum-card cursor-pointer
              flex items-start gap-3 p-3.5
              bg-card/95 backdrop-blur-md
              hover:bg-secondary/60
              transition-colors duration-150
              select-none
            "
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-base shrink-0 overflow-hidden">
              {incoming.senderAvatarUrl ? (
                <img
                  src={incoming.senderAvatarUrl}
                  alt={incoming.senderUsername}
                  className="w-full h-full object-cover"
                />
              ) : (
                incoming.senderDisplayName[0]?.toUpperCase()
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header row */}
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {/* Pulse dot */}
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                  <p className="font-bold text-sm truncate">
                    {incoming.senderDisplayName}
                  </p>
                </div>

                {/* Dismiss button */}
                <button
                  onClick={handleDismiss}
                  className="p-0.5 rounded-[3px] hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Username */}
              <p className="text-[10px] text-muted-foreground -mt-0.5 mb-1.5">
                @{incoming.senderUsername}
              </p>

              {/* Message preview */}
              <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-2">
                "{incoming.preview}"
              </p>

              {/* Footer CTA */}
              <div className="flex items-center gap-1 mt-2 text-[10px] font-semibold text-primary">
                <Send size={10} />
                <span>Tap to reply</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
