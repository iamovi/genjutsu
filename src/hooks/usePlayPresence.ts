import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface OnlinePlayer {
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
}

export function usePlayPresence() {
    const { user } = useAuth();
    const { profile } = useProfile();
    const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
    const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Fetch people I follow + people who follow me (mutual connections)
    useEffect(() => {
        if (!user) {
            setFollowedIds(new Set());
            return;
        }

        const fetchConnections = async () => {
            const [{ data: following }, { data: followers }] = await Promise.all([
                supabase.from('follows').select('following_id').eq('follower_id', user.id),
                supabase.from('follows').select('follower_id').eq('following_id', user.id),
            ]);

            const ids = new Set<string>();
            (following || []).forEach(f => ids.add(f.following_id));
            (followers || []).forEach(f => ids.add(f.follower_id));
            setFollowedIds(ids);
        };

        fetchConnections();
    }, [user]);

    // Join the play-lobby presence channel
    useEffect(() => {
        if (!user || !profile) return;

        const channel = supabase.channel('play-lobby', {
            config: {
                presence: { key: user.id },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const players: OnlinePlayer[] = [];

                Object.entries(state).forEach(([userId, presences]) => {
                    if (userId === user.id) return; // skip self
                    const p = (presences as any[])[0];
                    if (p) {
                        players.push({
                            user_id: userId,
                            username: p.username || '',
                            display_name: p.display_name || '',
                            avatar_url: p.avatar_url || null,
                        });
                    }
                });

                setOnlinePlayers(players);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        username: profile.username,
                        display_name: profile.display_name,
                        avatar_url: profile.avatar_url,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, profile?.username, profile?.display_name, profile?.avatar_url]);

    // Filter online players to only show connections (followers/following)
    const onlineFriends = onlinePlayers.filter(p => followedIds.has(p.user_id));
    const onlineOthers = onlinePlayers.filter(p => !followedIds.has(p.user_id));

    return {
        onlineFriends,
        onlineOthers,
        totalOnline: onlinePlayers.length,
        isTracking: !!channelRef.current,
    };
}
