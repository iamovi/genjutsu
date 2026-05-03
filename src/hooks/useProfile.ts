import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  created_at: string;
}

export function useProfile() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return data as Profile | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateProfile = async (updates: Partial<Pick<Profile, "display_name" | "bio" | "avatar_url" | "banner_url">>) => {
    if (!user) return { error: "Not authenticated" };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    if (!error) {
      queryClient.setQueryData(["profile", user.id], (old: Profile | null) =>
        old ? { ...old, ...updates } : old
      );
    }
    return { error };
  };

  // Cooldown status from server (single source of truth)
  const { data: cooldownStatus } = useQuery({
    queryKey: ["username-cooldown", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_username_cooldown" as any);
      return data as { on_cooldown: boolean; available_at?: string } | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const getNextUsernameChangeDate = (): Date | null => {
    if (!cooldownStatus?.on_cooldown || !cooldownStatus?.available_at) return null;
    return new Date(cooldownStatus.available_at);
  };

  const changeUsername = async (newUsername: string): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not authenticated" };

    // Client-side validation for instant feedback
    const normalized = newUsername.trim().toLowerCase();

    if (normalized.length < 3 || normalized.length > 20) {
      return { error: "Username must be 3–20 characters" };
    }
    if (!/^[a-z0-9_]+$/.test(normalized)) {
      return { error: "Only lowercase letters, numbers, and underscores allowed" };
    }
    if (profile?.username === normalized) {
      return { error: "That's already your username" };
    }

    // Server-side RPC (enforces cooldown, uniqueness, and validation)
    const { data, error } = await supabase.rpc("change_username" as any, {
      p_new_username: normalized,
    });

    if (error) {
      return { error: error.message };
    }

    const result = data as any;
    if (result?.error) {
      return { error: result.message || result.error };
    }

    // Update caches on success
    queryClient.setQueryData(["profile", user.id], (old: Profile | null) =>
      old ? { ...old, username: normalized } : old
    );
    queryClient.invalidateQueries({ queryKey: ["username-cooldown", user.id] });

    return { error: null };
  };

  const deleteAccount = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: "Not authenticated" };

    const { data, error } = await supabase.rpc("delete_user_account" as any);

    if (error) {
      return { error: error.message };
    }

    const result = data as any;
    if (result?.error) {
      return { error: result.message || result.error };
    }

    // On success, sign out locally
    await signOut({ scope: 'local' });
    queryClient.clear();

    return { error: null };
  };

  return {
    profile: profile ?? null,
    loading,
    updateProfile,
    changeUsername,
    deleteAccount,
    getNextUsernameChangeDate
  };
}
