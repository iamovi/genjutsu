import { useState, useCallback, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import HomeScreen from '@/components/play/HomeScreen';
import RoomView from '@/components/play/RoomView';
import { useSupabaseConnection } from '@/hooks/useSupabaseConnection';
import { usePlayPresence, OnlinePlayer } from '@/hooks/usePlayPresence';
import { usePlayInvites } from '@/hooks/usePlayInvites';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { Swords, X } from 'lucide-react';

const PlayPage = () => {
    const { user } = useAuth();
    const { profile } = useProfile();
    const peer = useSupabaseConnection();
    const presence = usePlayPresence();
    const invites = usePlayInvites();
    const [challengingUserId, setChallengingUserId] = useState<string | null>(null);

    // Handle incoming invites — show toast
    useEffect(() => {
        if (!invites.pendingInvite) return;

        const invite = invites.pendingInvite;

        toast(
            `${invite.fromDisplayName} wants to play!`,
            {
                description: `@${invite.fromUsername} sent you a game challenge`,
                icon: <Swords className="h-4 w-4" />,
                duration: 15000,
                action: {
                    label: 'Accept',
                    onClick: () => {
                        // Join the room that was created by the inviter
                        const name = profile?.display_name || 'Player';
                        peer.joinRoom(invite.roomCode, name);
                        invites.clearInvite();
                    },
                },
                cancel: {
                    label: 'Decline',
                    onClick: () => {
                        invites.declineInvite();
                    },
                },
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invites.pendingInvite]);

    // Handle when our invite gets declined — leave the waiting room
    useEffect(() => {
        if (!invites.declinedBy) return;

        const decline = invites.declinedBy;

        // Leave the room we created
        peer.leaveRoom();
        setChallengingUserId(null);

        toast(
            `${decline.byDisplayName} declined`,
            {
                description: `@${decline.byUsername} isn't available right now`,
                icon: <X className="h-4 w-4" />,
                duration: 4000,
            }
        );

        invites.clearDecline();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invites.declinedBy]);

    // Handle challenging a friend
    const handleChallenge = useCallback(async (player: OnlinePlayer) => {
        if (!profile) return;

        setChallengingUserId(player.user_id);

        // Create a room first
        peer.createRoom(profile.display_name);

        // We need to wait a moment for the room code to be generated
        // The room code is set asynchronously in createRoom
    }, [profile, peer]);

    // Send invite once room code is ready (after createRoom sets it)
    useEffect(() => {
        if (challengingUserId && peer.roomCode && peer.status === 'waiting') {
            invites.sendInvite(challengingUserId, peer.roomCode);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [challengingUserId, peer.roomCode, peer.status]);

    // Clear challenging state when connected or disconnected
    useEffect(() => {
        if (peer.status === 'connected' || peer.status === 'disconnected') {
            setChallengingUserId(null);
        }
    }, [peer.status]);

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Helmet>
                <title>Play | Genjutsu</title>
                <meta name="description" content="Play mini games with friends in real-time." />
            </Helmet>
            <Navbar />
            <main className="flex-1 flex flex-col">
                {peer.status === 'disconnected' ? (
                    <HomeScreen
                        onCreateRoom={peer.createRoom}
                        onJoinRoom={peer.joinRoom}
                        isLoggedIn={!!user}
                        displayName={profile?.display_name || ''}
                        onlineFriends={presence.onlineFriends}
                        onlineOthers={presence.onlineOthers}
                        totalOnline={presence.totalOnline}
                        onChallenge={handleChallenge}
                        challengingUserId={challengingUserId}
                    />
                ) : (
                    <RoomView {...peer} />
                )}
            </main>
        </div>
    );
};

export default PlayPage;
