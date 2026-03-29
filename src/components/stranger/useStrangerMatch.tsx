import { useState, useEffect, useRef, useCallback } from 'react';
import * as Ably from 'ably';

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger' | 'system';
  timestamp: number;
}

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY; // Fallback for local dev only

export function useStrangerMatch(userName: string = "Anonymous") {
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [strangerName, setStrangerName] = useState<string>('Stranger');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isStrangerTyping, setIsStrangerTyping] = useState<boolean>(false);
  
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const lobbyChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const chatChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const mountedRef = useRef<boolean>(true);

  // Safe setState wrappers — prevents "Should have a queue" React error
  // by guarding against state updates after unmount
  const safeSetStatus = useCallback((v: 'idle' | 'searching' | 'matched') => { if (mountedRef.current) setStatus(v); }, []);
  const safeSetMessages = useCallback((v: Message[] | ((prev: Message[]) => Message[])) => { if (mountedRef.current) setMessages(v); }, []);
  const safeSetStrangerName = useCallback((v: string) => { if (mountedRef.current) setStrangerName(v); }, []);
  const safeSetOnlineCount = useCallback((v: number) => { if (mountedRef.current) setOnlineCount(v); }, []);
  const safeSetIsStrangerTyping = useCallback((v: boolean) => { if (mountedRef.current) setIsStrangerTyping(v); }, []);

  useEffect(() => {
    mountedRef.current = true;

    if (!ABLY_KEY) {
       console.error("VITE_ABLY_KEY is missing. Genjutsu Stranger cannot connect.");
       return;
    }
    // Initialize Ably
    const clientId = "user_" + Math.random().toString(36).substring(2, 10);
    const client = new Ably.Realtime({ key: ABLY_KEY, clientId });
    ablyRef.current = client;

    // Join global channel just to track active users on the page
    const globalChannel = client.channels.get('genjutsu_stranger_global');
    globalChannel.presence.enter().catch(() => {});
    
    const updateCount = async () => {
        try {
            const presence = await globalChannel.presence.get();
            safeSetOnlineCount(Math.max(1, presence.length));
        } catch (e) {}
    };

    globalChannel.presence.subscribe(['enter', 'leave'], updateCount);
    updateCount();

    return () => {
      mountedRef.current = false;
      globalChannel.presence.leave().catch(() => {});
      globalChannel.presence.unsubscribe();
      client.close();
    };
  }, []);

  const startSearch = async () => {
    if (!ablyRef.current) return;
    safeSetStatus('searching');
    safeSetMessages([]);
    safeSetStrangerName('Stranger');
    safeSetIsStrangerTyping(false);
    
    const ably = ablyRef.current;
    
    // Disconnect from previous chat if any
    if (chatChannelRef.current) {
       chatChannelRef.current.presence.leave().catch(() => {});
       try { chatChannelRef.current.detach(); } catch(e) {}
    }

    const lobby = ably.channels.get('genjutsu_stranger_lobby');
    lobbyChannelRef.current = lobby;

    // Listen for incoming match offers
    lobby.subscribe('offer', (msg) => {
       if (msg.data.target === ably.auth.clientId) {
          // Accept offer
          lobby.presence.leave().catch(() => {});
          try { lobby.detach(); } catch(e) {}
          joinChat(msg.data.channel, msg.data.strangerName || 'Stranger');
       }
    });

    try {
        // Enter presence so others can see we are searching
        await lobby.presence.enter({ searching: true, name: userName });
        
        // Check if anyone else is already waiting
        const presenceSet = await lobby.presence.get();
        const otherWaiters = presenceSet.filter(p => p.clientId !== ably.auth.clientId && p.data?.searching);
        
        if (otherWaiters.length > 0) {
           // Pick the first random waiter
           const target = otherWaiters[Math.floor(Math.random() * otherWaiters.length)];
           const newChatChannelId = `chat_${Math.random().toString(36).substring(2)}`;
           
           // Send offer exclusively to them
           lobby.publish('offer', { target: target.clientId, channel: newChatChannelId, strangerName: userName });
           
           // Clean up lobby and join the new private chat
           lobby.presence.leave().catch(() => {});
           try { lobby.detach(); } catch(e) {}
           joinChat(newChatChannelId, target.data?.name || "Stranger");
        }
    } catch (e: any) {
        console.warn("Ably search logic interrupted:", e.message);
    }
  };

  const joinChat = async (channelId: string, name: string) => {
     safeSetStatus('matched');
     safeSetStrangerName(name);
     const ably = ablyRef.current!;
     const chatChannel = ably.channels.get(channelId);
     chatChannelRef.current = chatChannel;

     try {
         // Enter presence to track disconnects
         await chatChannel.presence.enter();
     } catch (e: any) {
         console.warn("Ably chat join interrupted:", e.message);
     }
     
     chatChannel.presence.subscribe('leave', (member) => {
         if (member.clientId !== ably.auth.clientId) {
            safeSetStatus('idle');
            safeSetMessages(prev => [...prev, { id: Math.random().toString(), text: 'Stranger has disconnected.', sender: 'system', timestamp: Date.now() }]);
            try { chatChannel.detach(); } catch(e) {}
         }
     });

     // Listen for incoming messages
     chatChannel.subscribe('message', (msg) => {
         if (msg.connectionId !== ably.connection.id) {
             safeSetMessages(prev => [...prev, { id: msg.id, text: msg.data.text, sender: 'stranger', timestamp: msg.timestamp }]);
             safeSetIsStrangerTyping(false);
         }
     });

     chatChannel.subscribe('typing', (msg) => {
         if (msg.connectionId !== ably.connection.id) {
             safeSetIsStrangerTyping(msg.data.isTyping);
         }
     });
  };

  const sendMessage = (text: string) => {
     if (chatChannelRef.current && status === 'matched') {
         chatChannelRef.current.publish('message', { text });
         safeSetMessages(prev => [...prev, { id: Math.random().toString(), text, sender: 'me', timestamp: Date.now() }]);
     }
  };

  const sendTypingIndicator = (isTyping: boolean) => {
      if (status === 'matched' && chatChannelRef.current) {
          chatChannelRef.current.publish('typing', { isTyping }).catch(() => {});
      }
  };

  const stopSearch = () => {
     if (lobbyChannelRef.current) {
         lobbyChannelRef.current.presence.leave().catch(() => {});
         try { lobbyChannelRef.current.detach(); } catch(e) {}
     }
     if (chatChannelRef.current) {
         chatChannelRef.current.presence.leave().catch(() => {});
         try { chatChannelRef.current.detach(); } catch(e) {}
     }
     safeSetStatus('idle');
     safeSetIsStrangerTyping(false);
     safeSetMessages(prev => [...prev, { id: Math.random().toString(), text: 'You disconnected.', sender: 'system', timestamp: Date.now() }]);
  };

  return { status, messages, sendMessage, startSearch, stopSearch, strangerName, onlineCount, isStrangerTyping, sendTypingIndicator };
}
