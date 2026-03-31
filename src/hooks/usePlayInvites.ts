import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PlayInvite {
    roomCode: string;
    fromUserId: string;
    fromUsername: string;
    fromDisplayName: string;
    fromAvatarUrl: string | null;
    timestamp: number;
}

export interface InviteDecline {
    byUsername: string;
    byDisplayName: string;
}

export function usePlayInvites() {
    const { user } = useAuth();
    const { profile } = useProfile();
    const [pendingInvite, setPendingInvite] = useState<PlayInvite | null>(null);
    const [declinedBy, setDeclinedBy] = useState<InviteDecline | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    // Listen for incoming invites AND decline responses on my personal channel
    useEffect(() => {
        if (!user) return;

        const channel = supabase.channel(`play-invite-${user.id}`);

        channel
            .on('broadcast', { event: 'game-invite' }, ({ payload }) => {
                setPendingInvite(payload as PlayInvite);
            })
            .on('broadcast', { event: 'invite-cancelled' }, () => {
                setPendingInvite(null);
            })
            .on('broadcast', { event: 'invite-declined' }, ({ payload }) => {
                setDeclinedBy(payload as InviteDecline);
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            channelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    // Send an invite to another user
    const sendInvite = useCallback(async (targetUserId: string, roomCode: string) => {
        if (!user || !profile) return;

        const targetChannel = supabase.channel(`play-invite-${targetUserId}`);

        await new Promise<void>((resolve) => {
            targetChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    targetChannel.send({
                        type: 'broadcast',
                        event: 'game-invite',
                        payload: {
                            roomCode,
                            fromUserId: user.id,
                            fromUsername: profile.username,
                            fromDisplayName: profile.display_name,
                            fromAvatarUrl: profile.avatar_url,
                            timestamp: Date.now(),
                        } as PlayInvite,
                    });
                    setTimeout(() => {
                        supabase.removeChannel(targetChannel);
                    }, 500);
                    resolve();
                }
            });
        });
    }, [user, profile]);

    // Decline an invite and notify the challenger
    const declineInvite = useCallback(async () => {
        if (!pendingInvite || !profile) return;

        const challengerChannel = supabase.channel(`play-invite-${pendingInvite.fromUserId}`);

        await new Promise<void>((resolve) => {
            challengerChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    challengerChannel.send({
                        type: 'broadcast',
                        event: 'invite-declined',
                        payload: {
                            byUsername: profile.username,
                            byDisplayName: profile.display_name,
                        } as InviteDecline,
                    });
                    setTimeout(() => {
                        supabase.removeChannel(challengerChannel);
                    }, 500);
                    resolve();
                }
            });
        });

        setPendingInvite(null);
    }, [pendingInvite, profile]);

    // Cancel a sent invite
    const cancelInvite = useCallback(async (targetUserId: string) => {
        const targetChannel = supabase.channel(`play-invite-${targetUserId}`);

        await new Promise<void>((resolve) => {
            targetChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    targetChannel.send({
                        type: 'broadcast',
                        event: 'invite-cancelled',
                        payload: {},
                    });
                    setTimeout(() => {
                        supabase.removeChannel(targetChannel);
                    }, 500);
                    resolve();
                }
            });
        });
    }, []);

    const clearInvite = useCallback(() => {
        setPendingInvite(null);
    }, []);

    const clearDecline = useCallback(() => {
        setDeclinedBy(null);
    }, []);

    return {
        pendingInvite,
        declinedBy,
        sendInvite,
        declineInvite,
        cancelInvite,
        clearInvite,
        clearDecline,
    };
}
