import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getConfig } from "@/lib/config";

const PUSH_ENABLED_KEY = "genjutsu-push-enabled";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [loading, setLoading] = useState(false);

  // Check if push notifications are supported
  useEffect(() => {
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check current subscription status on mount
  useEffect(() => {
    if (!isSupported || !user) return;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      } catch {
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [isSupported, user]);

  const subscribe = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user || !isSupported) {
      return { error: "Push notifications are not supported" };
    }

    setLoading(true);

    try {
      // Request notification permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setLoading(false);
        return { error: "Notification permission denied" };
      }

      const config = getConfig();
      const vapidKey = config.VITE_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setLoading(false);
        return { error: "VAPID key not configured" };
      }

      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint!;
      const p256dh = subJson.keys!.p256dh!;
      const auth = subJson.keys!.auth!;

      // Save subscription to Supabase
      const sb = supabase as any;
      const { error: dbError } = await sb
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
          },
          { onConflict: "user_id,endpoint" }
        );

      if (dbError) {
        setLoading(false);
        return { error: dbError.message };
      }

      localStorage.setItem(PUSH_ENABLED_KEY, "true");
      setIsSubscribed(true);
      setLoading(false);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: err?.message || "Failed to subscribe" };
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async (): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not authenticated" };

    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;

        // Unsubscribe from push
        await subscription.unsubscribe();

        // Remove from Supabase
        const sb = supabase as any;
        await sb
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint);
      }

      localStorage.removeItem(PUSH_ENABLED_KEY);
      setIsSubscribed(false);
      setLoading(false);
      return { error: null };
    } catch (err: any) {
      setLoading(false);
      return { error: err?.message || "Failed to unsubscribe" };
    }
  }, [user]);

  const toggle = useCallback(async (): Promise<{ error: string | null }> => {
    if (isSubscribed) {
      return unsubscribe();
    }
    return subscribe();
  }, [isSubscribed, subscribe, unsubscribe]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    toggle,
  };
}
