import { useState, useEffect, useRef, useCallback } from 'react';
import * as Ably from 'ably';
import { getConfig } from "@/lib/config";

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger' | 'system';
  timestamp: number;
}

export function useStrangerMatch() {
  const [status, setStatus] = useState<'idle' | 'searching' | 'matched'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [strangerName, setStrangerName] = useState<string>('Stranger');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isStrangerTyping, setIsStrangerTyping] = useState<boolean>(false);
  
  const ablyRef = useRef<Ably.Realtime | null>(null);
  const lobbyChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const chatChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  
  const mountedRef = useRef<boolean>(true);
  const isActionPending = useRef<boolean>(false);
  const alreadyMatchedRef = useRef<boolean>(false);

  const STORAGE_KEY = 'genjutsu_stranger_id';

  // Safe setState wrappers — prevents "Should have a queue" React error
  // by guarding against state updates after unmount
  const safeSetStatus = useCallback((v: 'idle' | 'searching' | 'matched') => { if (mountedRef.current) setStatus(v); }, []);
  const safeSetMessages = useCallback((v: Message[] | ((prev: Message[]) => Message[])) => { if (mountedRef.current) setMessages(v); }, []);
  const safeSetStrangerName = useCallback((v: string) => { if (mountedRef.current) setStrangerName(v); }, []);
  const safeSetOnlineCount = useCallback((v: number) => { if (mountedRef.current) setOnlineCount(v); }, []);
  const safeSetIsStrangerTyping = useCallback((v: boolean) => { if (mountedRef.current) setIsStrangerTyping(v); }, []);

  useEffect(() => {
    mountedRef.current = true;
    // getConfig() is safely called inside useEffect — config is guaranteed
    // to be loaded before any component mounts (see main.tsx loadConfig().then(...))
    const ABLY_KEY = getConfig().VITE_ABLY_KEY;

    if (!ABLY_KEY) {
       console.error("VITE_ABLY_KEY is missing.");
       safeSetMessages([{ id: 'error', text: 'Configuration error: Connection failed.', sender: 'system', timestamp: Date.now() }]);
       return;
    }
    // Initialize Ably with persistent clientId
    let clientId = sessionStorage.getItem(STORAGE_KEY);
    if (!clientId) {
        clientId = "user_" + Math.random().toString(36).substring(2, 12);
        sessionStorage.setItem(STORAGE_KEY, clientId);
    }

    const client = new Ably.Realtime({ key: ABLY_KEY, clientId });
    ablyRef.current = client;

    // Join global channel just to track active users on the page
    const globalChannel = client.channels.get('genjutsu_stranger_global');
    globalChannel.presence.enter().catch(() => {});
    
    const updateCount = async () => {
        try {
            const presence = await globalChannel.presence.get();
            safeSetOnlineCount(Math.max(1, presence.length));
        } catch (e) {
            /* ignore error */
        }
    };

    globalChannel.presence.subscribe(['enter', 'leave'], updateCount);
    updateCount();

    return () => {
      mountedRef.current = false;
      try {
        globalChannel.presence.leave().catch(() => {});
        globalChannel.presence.unsubscribe();
        client.close();
      } catch (e) {
        // Silently handle — connection may already be dead on slow networks
      }
    };
  }, [safeSetMessages, safeSetOnlineCount]);

  const startSearch = async () => {
    if (!ablyRef.current || isActionPending.current) return;
    
    isActionPending.current = true;
    alreadyMatchedRef.current = false;
    
    safeSetStatus('searching');
    safeSetMessages([]);
    safeSetStrangerName('Stranger');
    safeSetIsStrangerTyping(false);
    
    const ably = ablyRef.current;
    
    try {
        // Fully clean up any previous chat channel
        if (chatChannelRef.current) {
           const prevChat = chatChannelRef.current;
           chatChannelRef.current = null;
           prevChat.unsubscribe();
           prevChat.presence.unsubscribe();
           await prevChat.presence.leave().catch(() => {});
           try { prevChat.detach(); } catch(e) { /* ignore error */ }
        }

        const lobby = ably.channels.get('genjutsu_stranger_lobby');
        lobbyChannelRef.current = lobby;

        // Clear previous subscriptions
        lobby.unsubscribe();

        // Listen for incoming match offers
        lobby.subscribe('offer', (msg) => {
           if (alreadyMatchedRef.current) return;
           if (msg.data.target === ably.auth.clientId) {
              alreadyMatchedRef.current = true;
              lobby.unsubscribe();
              lobby.presence.leave().catch(() => {});
              joinChat(msg.data.channel, 'Stranger');
           }
        });

        // Enter presence so others can see we are searching
        await lobby.presence.enter({ searching: true });
        
        // Check if anyone else is already waiting
        const presenceSet = await lobby.presence.get();
        const otherWaiters = presenceSet.filter(p => p.clientId !== ably.auth.clientId && p.data?.searching);
        
        if (otherWaiters.length > 0 && !alreadyMatchedRef.current) {
           alreadyMatchedRef.current = true;
           const target = otherWaiters[Math.floor(Math.random() * otherWaiters.length)];
           const newChatChannelId = `chat_${Math.random().toString(36).substring(2)}`;
           
           await lobby.publish('offer', { target: target.clientId, channel: newChatChannelId });
           
           lobby.unsubscribe();
           lobby.presence.leave().catch(() => {});
           joinChat(newChatChannelId, "Stranger");
        }
    } catch (e: any) {
        console.warn("Matchmaking initialization error:", e.message);
        safeSetStatus('idle');
    } finally {
        isActionPending.current = false;
    }
  };

  const joinChat = async (channelId: string, name: string) => {
     // Clear pending actions if we were searching
     isActionPending.current = true;
     
     safeSetStatus('matched');
     safeSetMessages(prev => [...prev, { id: 'sys_' + Date.now(), text: 'Stranger found! Say hi.', sender: 'system', timestamp: Date.now() }]);
     safeSetStrangerName(name);
     const ably = ablyRef.current!;

     try {
         // Fully clean up any previous chat channel before joining a new one
         if (chatChannelRef.current) {
             const prevChat = chatChannelRef.current;
             chatChannelRef.current = null;
             prevChat.unsubscribe();
             prevChat.presence.unsubscribe();
             await prevChat.presence.leave().catch(() => {});
             try { prevChat.detach(); } catch(e) { /* ignore error */ }
         }

         const chatChannel = ably.channels.get(channelId);
         chatChannelRef.current = chatChannel;

         // Enter presence to track disconnects
         await chatChannel.presence.enter();
         
         chatChannel.presence.subscribe('leave', (member) => {
             if (member.clientId !== ably.auth.clientId) {
                safeSetStatus('idle');
                safeSetIsStrangerTyping(false);
                safeSetMessages(prev => [...prev, { id: 'disc_' + Date.now(), text: 'Stranger has disconnected.', sender: 'system', timestamp: Date.now() }]);
                chatChannel.unsubscribe();
                chatChannel.presence.unsubscribe();
                try { chatChannel.detach(); } catch(e) { /* ignore error */ }
                chatChannelRef.current = null;
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
     } catch (e: any) {
         console.warn("Chat session error:", e.message);
         safeSetStatus('idle');
     } finally {
         isActionPending.current = false;
     }
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

  const stopSearch = async () => {
     if (isActionPending.current) return;
     isActionPending.current = true;

     try {
         if (lobbyChannelRef.current) {
             const lobby = lobbyChannelRef.current;
             lobbyChannelRef.current = null;
             lobby.unsubscribe();
             lobby.presence.unsubscribe();
             await lobby.presence.leave().catch(() => {});
             try { lobby.detach(); } catch(e) { /* ignore error */ }
         }
         if (chatChannelRef.current) {
             const chat = chatChannelRef.current;
             chatChannelRef.current = null;
             chat.unsubscribe();
             chat.presence.unsubscribe();
             await chat.presence.leave().catch(() => {});
             try { chat.detach(); } catch(e) { /* ignore error */ }
         }
     } catch (e) {
         /* ignore error */
     }

      safeSetStatus('idle');
      safeSetIsStrangerTyping(false);
      safeSetMessages(prev => [...prev, { id: 'stop_' + Date.now(), text: 'You disconnected.', sender: 'system', timestamp: Date.now() }]);
      isActionPending.current = false;
   };

   const skip = async () => {
       await stopSearch();
       await startSearch();
   };

   return { status, messages, sendMessage, startSearch, stopSearch, skip, strangerName, onlineCount, isStrangerTyping, sendTypingIndicator };
 }
