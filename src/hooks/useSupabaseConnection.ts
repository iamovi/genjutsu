import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, ConnectionStatus, GameId, PeerMessage } from '@/types/game';
import { RealtimeChannel } from '@supabase/supabase-js';

function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export function useSupabaseConnection() {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [roomCode, setRoomCode] = useState('');
    const [myName, setMyName] = useState('');
    const [peerName, setPeerName] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [activeGame, setActiveGame] = useState<GameId | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [pendingInvite, setPendingInvite] = useState<GameId | null>(null);
    const [isInviter, setIsInviter] = useState(false);
    const [peerTyping, setPeerTyping] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [peerDisconnected, setPeerDisconnected] = useState(false);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const myNameRef = useRef('');

    const send = useCallback((msg: PeerMessage) => {
        if (channelRef.current) {
            console.debug('[Supabase] Sending:', msg.type, msg);
            channelRef.current.send({
                type: 'broadcast',
                event: 'game-event',
                payload: msg,
            }).then(resp => {
                if (resp !== 'ok') console.error('[Supabase] Send failed:', resp);
            });
        } else {
            console.warn('[Supabase] Cannot send, no active channel');
        }
    }, []);

    const handleMessage = useCallback((payload: PeerMessage) => {
        console.debug('[Supabase] Received:', payload.type, payload);
        switch (payload.type) {
            case 'chat':
                setMessages(prev => [...prev, { ...payload, isMe: false }]);
                break;
            case 'player-info':
                setPeerName(payload.name);
                break;
            case 'game-invite':
                setPendingInvite(payload.gameId);
                setIsInviter(false);
                break;
            case 'game-accept':
                setActiveGame(payload.gameId);
                setPendingInvite(null);
                setIsInviter(false);
                setGameState(null);
                break;
            case 'game-decline':
                setPendingInvite(null);
                setIsInviter(false);
                break;
            case 'game-state':
                setGameState(payload.state);
                break;
            case 'typing':
                setPeerTyping(payload.isTyping);
                break;
            case 'leave-game':
                setActiveGame(null);
                setGameState(null);
                break;
        }
    }, []);

    const clearConnection = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    const createRoom = useCallback((name: string) => {
        myNameRef.current = name;
        setMyName(name);
        setIsHost(true);
        const code = generateRoomCode();
        setRoomCode(code);
        setStatus('waiting');

        const channel = supabase.channel(`room-${code}`, {
            config: {
                broadcast: { self: false },
                presence: { key: name },
            },
        });

        channel
            .on('broadcast', { event: 'game-event' }, ({ payload }) => {
                handleMessage(payload);
            })
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                console.debug('[Supabase] Presence sync (host):', state);
                if (Object.keys(state).length >= 2) {
                    setStatus('connected');
                    setPeerDisconnected(false);
                }
            })
            .on('presence', { event: 'join' }, async ({ newPresences }) => {
                console.debug('[Supabase] New presence join:', newPresences);
                // Only mark as connected if someone OTHER than us joined
                const others = newPresences.filter(p => p.presence_ref !== undefined); // Simplified check or use state count
                const state = channel.presenceState();
                if (Object.keys(state).length >= 2) {
                    setStatus('connected');
                    setPeerDisconnected(false);
                    // Send our info to the new person
                    console.debug('[Supabase] Sending player-info to new joiner');
                    try {
                        await channel.send({
                            type: 'broadcast',
                            event: 'game-event',
                            payload: { type: 'player-info', name: myNameRef.current }
                        });
                    } catch (error) {
                        console.error('[Supabase] Failed to send player-info:', error);
                    }
                }
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                console.debug('[Supabase] Presence left:', leftPresences);
                if (leftPresences.length > 0) {
                    setPeerDisconnected(true);
                }
            })
            .subscribe(async (status) => {
                console.log('[Supabase] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('[Supabase] Subscribed successfully to room:', code);
                    await channel.track({ online_at: new Date().toISOString(), name });
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('[Supabase] Subscription error:', status);
                    setStatus('disconnected');
                }
            });

        channelRef.current = channel;
    }, [handleMessage]);

    const joinRoom = useCallback((code: string, name: string) => {
        const upperCode = code.toUpperCase();
        myNameRef.current = name;
        setMyName(name);
        setIsHost(false);
        setRoomCode(upperCode);
        setStatus('joining');

        const channel = supabase.channel(`room-${upperCode}`, {
            config: {
                broadcast: { self: false },
                presence: { key: name },
            },
        });

        channel
            .on('broadcast', { event: 'game-event' }, ({ payload }) => {
                handleMessage(payload);
            })
            .on('presence', { event: 'sync' }, async () => {
                const state = channel.presenceState();
                console.debug('[Supabase] Presence sync:', state);
                if (Object.keys(state).length >= 2) {
                    setStatus('connected');
                    setPeerDisconnected(false);
                    // Send our info
                    console.debug('[Supabase] Sending player-info after sync');
                    try {
                        await channel.send({
                            type: 'broadcast',
                            event: 'game-event',
                            payload: { type: 'player-info', name: myNameRef.current }
                        });
                    } catch (error) {
                        console.error('[Supabase] Failed to send player-info after sync:', error);
                    }
                }
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }) => {
                console.debug('[Supabase] Presence left:', leftPresences);
                if (leftPresences.length > 0) {
                    setPeerDisconnected(true);
                }
            })
            .subscribe(async (status) => {
                console.log('[Supabase] Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('[Supabase] Joined successfully to room:', upperCode);
                    await channel.track({ online_at: new Date().toISOString(), name });
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    console.error('[Supabase] Channel closed or error:', status);
                    setStatus('disconnected');
                }
            });

        channelRef.current = channel;
    }, [handleMessage]);

    const sendChat = useCallback((text: string) => {
        const id = Math.random().toString(36).slice(2);
        const timestamp = Date.now();
        const msg: PeerMessage = { type: 'chat', text, sender: myNameRef.current, timestamp, id };
        send(msg);
        setMessages(prev => [...prev, { id, text, sender: myNameRef.current, timestamp, isMe: true }]);
    }, [send]);

    const sendGameInvite = useCallback((gameId: GameId) => {
        send({ type: 'game-invite', gameId });
        setPendingInvite(gameId);
        setIsInviter(true);
    }, [send]);

    const acceptGameInvite = useCallback(() => {
        if (pendingInvite) {
            send({ type: 'game-accept', gameId: pendingInvite });
            setActiveGame(pendingInvite);
            setPendingInvite(null);
            setGameState(null);
        }
    }, [send, pendingInvite]);

    const declineGameInvite = useCallback(() => {
        send({ type: 'game-decline' });
        setPendingInvite(null);
    }, [send]);

    const sendGameState = useCallback((gameId: GameId, state: any) => {
        send({ type: 'game-state', gameId, state });
    }, [send]);

    const sendTyping = useCallback((isTyping: boolean) => {
        send({ type: 'typing', isTyping });
    }, [send]);

    const leaveGame = useCallback(() => {
        send({ type: 'leave-game' });
        setActiveGame(null);
        setGameState(null);
    }, [send]);

    const leaveRoom = useCallback(() => {
        clearConnection();
        setStatus('disconnected');
        setRoomCode('');
        setPeerName('');
        setMessages([]);
        setActiveGame(null);
        setGameState(null);
        setPendingInvite(null);
        setIsHost(false);
        setPeerDisconnected(false);
    }, [clearConnection]);

    useEffect(() => {
        return () => {
            clearConnection();
        };
    }, [clearConnection]);

    return {
        status, roomCode, myName, peerName, messages,
        activeGame, gameState, pendingInvite, isInviter,
        peerTyping, isHost, peerDisconnected,
        createRoom, joinRoom, sendChat, sendGameInvite,
        acceptGameInvite, declineGameInvite, sendGameState,
        sendTyping, leaveGame, leaveRoom, setActiveGame,
    };
}
