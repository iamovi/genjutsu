import { useState, useEffect } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/hooks/useAuth";
import { Bell, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const pushNotifications = usePushNotifications();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const dismissedKey = user ? `genjutsu_push_prompt_dismissed_${user.id}` : null;

  // Check localStorage and subscription state on mount
  useEffect(() => {
    if (!user || !dismissedKey) return; // Only prompt logged-in users

    const isDismissed = localStorage.getItem(dismissedKey);
    
    // Show prompt if:
    // 1. Not dismissed previously
    // 2. Not currently subscribed
    // 3. Browser supports push notifications
    // 4. Permission is not permanently denied (optional, but good UX to not bug them if they denied it at the OS level)
    if (
      !isDismissed &&
      !pushNotifications.isSubscribed &&
      pushNotifications.isSupported &&
      pushNotifications.permission !== "denied"
    ) {
      // Small delay so it doesn't pop up instantly on first load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [
    user,
    dismissedKey,
    pushNotifications.isSubscribed,
    pushNotifications.isSupported,
    pushNotifications.permission,
  ]);

  const handleDismiss = () => {
    if (!dismissedKey) return;
    localStorage.setItem(dismissedKey, "true");
    setIsVisible(false);
  };

  const handleEnable = () => {
    navigate("/settings");
    handleDismiss(); // Hide the banner, since they are heading to settings
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-20 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        >
          <div className="gum-card bg-card/95 backdrop-blur-md pointer-events-auto flex items-center gap-4 p-3 shadow-xl border-primary/20 max-w-lg w-full">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Bell className="text-primary" size={20} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm truncate">Never miss a whisper</h4>
              <p className="text-xs text-muted-foreground truncate">
                Enable push notifications to get alerts even when closed.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleEnable}
                className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-[3px] hover:bg-primary/90 transition-colors"
              >
                Enable
              </button>
              <button
                onClick={handleDismiss}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-[3px] transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
