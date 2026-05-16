import { useState, useEffect, useRef, useCallback } from 'react';
import * as Ably from 'ably';
import { getConfig } from "@/lib/config";

export interface Message {
  id: string;
  text: string;
  sender: 'me' | 'stranger' | 'system';
  timestamp: number;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export type StrangerStatus = 'idle' | 'searching' | 'matched';
export type StrangerMatchMode = 'random' | 'shared';
export type StrangerConnectionState = 'initialized' | 'connecting' | 'connected' | 'disconnected' | 'suspended' | 'failed' | 'closed';

export interface StrangerInterest {
  id: string;
  label: string;
  emoji: string;
}

export interface StrangerSearchOptions {
  interests: string[];
  matchMode: StrangerMatchMode;
}

interface LobbyPresenceData extends StrangerSearchOptions {
  searching: boolean;
  startedAt: number;
  searchId: string;
  version: number;
}

interface OfferPayload {
  target: string;
  targetSearchId: string;
  fromClientId: string;
  channel: string;
  matchId: string;
  interests: string[];
  matchMode: StrangerMatchMode;
  offeredAt: number;
}

const STORAGE_KEY = 'genjutsu_stranger_id';
const LOBBY_CHANNEL = 'genjutsu_stranger_lobby';
const GLOBAL_CHANNEL = 'genjutsu_stranger_global';
const MAX_MESSAGE_LENGTH = 600;
const MIN_MESSAGE_INTERVAL_MS = 850;
const SHARED_MATCH_FALLBACK_MS = 8000;
const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

const BLOCKED_WORDS = ['slur', 'doxx', 'kys'];

export const STRANGER_INTERESTS: StrangerInterest[] = [
  { id: 'javascript', label: 'JavaScript', emoji: '🟨' },
  { id: 'react', label: 'React', emoji: '⚛️' },
  { id: 'ai', label: 'AI', emoji: '🤖' },
  { id: 'rust', label: 'Rust', emoji: '🦀' },
  { id: 'design', label: 'Design', emoji: '🎨' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'anime', label: 'Anime', emoji: '🌸' },
  { id: 'startup', label: 'Startup', emoji: '🚀' },
  { id: 'debugging', label: 'Debugging', emoji: '🐛' },
  { id: 'open-source', label: 'Open Source', emoji: '🌐' },
];

export const CONVERSATION_STARTERS = [
  'Ask what they are building right now.',
  'Tabs or spaces, and why is their answer dangerous?',
  'What bug wasted their week?',
  'Favorite language for a weekend project?',
  'What tool could they not live without?',
  'Ask for one underrated dev tip.',
  'What would they ship if they had 48 free hours?',
  'Ask about their current side quest.',
];

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeInterests = (interests: string[]) => {
  const allowed = new Set(STRANGER_INTERESTS.map((interest) => interest.id));
  return Array.from(new Set(interests.filter((interest) => allowed.has(interest)))).slice(0, 5);
};

const getSharedInterests = (a: string[], b: string[]) => a.filter((interest) => b.includes(interest));

const sanitizeMessage = (text: string) => {
  let cleaned = Array.from(text.replace(/\r\n?/g, '\n')).filter((char) => {
    const code = char.charCodeAt(0);
    return char === '\n' || (code > 31 && code !== 127);
  }).join('').replace(/\n{3,}/g, '\n\n').trim();
  BLOCKED_WORDS.forEach((word) => {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'gi'), '***');
  });
  return cleaned.slice(0, MAX_MESSAGE_LENGTH);
};

const getRandomStarter = () => CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)];

const getOrCreateClientId = () => {
  const generatedId = `user_${Math.random().toString(36).substring(2, 12)}`;

  try {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (storedId) return storedId;

    localStorage.setItem(STORAGE_KEY, generatedId);
  } catch (e) {
    // Private browsing or locked-down webviews can block localStorage.
  }

  return generatedId;
};

export function useStrangerMatch() {
  const [status, setStatus] = useState<StrangerStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [strangerName, setStrangerName] = useState<string>('Stranger');
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [isStrangerTyping, setIsStrangerTyping] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<StrangerConnectionState>('initialized');
  const [searchHint, setSearchHint] = useState('Ready for anonymous text chat.');
  const [peerInterests, setPeerInterests] = useState<string[]>([]);
  const [currentOptions, setCurrentOptions] = useState<StrangerSearchOptions>({ interests: [], matchMode: 'random' });
  const [blockedCount, setBlockedCount] = useState(0);

  const ablyRef = useRef<Ably.Realtime | null>(null);
  const globalChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const lobbyChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const chatChannelRef = useRef<Ably.RealtimeChannel | null>(null);

  const mountedRef = useRef<boolean>(true);
  const statusRef = useRef<StrangerStatus>('idle');
  const isActionPending = useRef<boolean>(false);
  const alreadyMatchedRef = useRef<boolean>(false);
  const searchIdRef = useRef<string>('');
  const optionsRef = useRef<StrangerSearchOptions>({ interests: [], matchMode: 'random' });
  const blockedPeersRef = useRef<Set<string>>(new Set());
  const currentPeerIdRef = useRef<string | null>(null);
  const lastMessageAtRef = useRef<number>(0);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackWidenedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeSetStatus = useCallback((v: StrangerStatus) => {
    statusRef.current = v;
    if (mountedRef.current) setStatus(v);
  }, []);
  const safeSetMessages = useCallback((v: Message[] | ((prev: Message[]) => Message[])) => { if (mountedRef.current) setMessages(v); }, []);
  const safeSetStrangerName = useCallback((v: string) => { if (mountedRef.current) setStrangerName(v); }, []);
  const safeSetOnlineCount = useCallback((v: number) => { if (mountedRef.current) setOnlineCount(v); }, []);
  const safeSetIsStrangerTyping = useCallback((v: boolean) => { if (mountedRef.current) setIsStrangerTyping(v); }, []);
  const safeSetConnectionState = useCallback((v: StrangerConnectionState) => { if (mountedRef.current) setConnectionState(v); }, []);
  const safeSetSearchHint = useCallback((v: string) => { if (mountedRef.current) setSearchHint(v); }, []);
  const safeSetPeerInterests = useCallback((v: string[]) => { if (mountedRef.current) setPeerInterests(v); }, []);
  const safeSetCurrentOptions = useCallback((v: StrangerSearchOptions) => { if (mountedRef.current) setCurrentOptions(v); }, []);
  const safeSetBlockedCount = useCallback((v: number) => { if (mountedRef.current) setBlockedCount(v); }, []);

  const addSystemMessage = useCallback((text: string, tone: Message['tone'] = 'default') => {
    safeSetMessages((prev) => [...prev, { id: createId('sys'), text, sender: 'system', timestamp: Date.now(), tone }]);
  }, [safeSetMessages]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const cleanupLobby = useCallback(async () => {
    const lobby = lobbyChannelRef.current;
    lobbyChannelRef.current = null;
    clearFallbackTimer();

    if (!lobby) return;

    lobby.unsubscribe();
    lobby.presence.unsubscribe();
    await lobby.presence.leave().catch(() => {});
    await lobby.detach().catch(() => {});
  }, [clearFallbackTimer]);

  const cleanupChat = useCallback(async () => {
    const chat = chatChannelRef.current;
    chatChannelRef.current = null;
    clearIdleTimer();
    safeSetIsStrangerTyping(false);

    if (!chat) return;

    chat.unsubscribe();
    chat.presence.unsubscribe();
    await chat.presence.leave().catch(() => {});
    await chat.detach().catch(() => {});
  }, [clearIdleTimer, safeSetIsStrangerTyping]);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    if (statusRef.current !== 'matched') return;

    idleTimerRef.current = setTimeout(() => {
      addSystemMessage('Idle timeout reached. You were disconnected to keep the lobby fresh.', 'warning');
      void cleanupChat().then(() => {
        currentPeerIdRef.current = null;
        safeSetStatus('idle');
      });
    }, IDLE_TIMEOUT_MS);
  }, [addSystemMessage, cleanupChat, clearIdleTimer, safeSetStatus]);

  const chooseCandidate = useCallback((presenceSet: any[], allowRandomFallback: boolean) => {
    const ably = ablyRef.current;
    if (!ably) return null;

    const myOptions = optionsRef.current;
    const candidates = presenceSet.filter((member) => {
      const data = member.data as LobbyPresenceData | undefined;
      if (!data?.searching || !data.searchId) return false;
      if (member.clientId === ably.auth.clientId) return false;
      if (blockedPeersRef.current.has(member.clientId)) return false;
      if (data.searchId === searchIdRef.current) return false;
      return true;
    });

    if (candidates.length === 0) return null;

    const scored = candidates.map((member) => {
      const data = member.data as LobbyPresenceData;
      const shared = getSharedInterests(myOptions.interests, data.interests || []);
      const wantsShared = myOptions.matchMode === 'shared' || data.matchMode === 'shared';
      const eligible = !wantsShared || shared.length > 0 || allowRandomFallback;
      return {
        member,
        data,
        shared,
        eligible,
        score: shared.length * 1000 - (Date.now() - (data.startedAt || Date.now())) / 1000,
      };
    }).filter((candidate) => candidate.eligible);

    if (scored.length === 0) return null;

    scored.sort((a, b) => b.score - a.score);
    const sharedCandidates = scored.filter((candidate) => candidate.shared.length > 0);
    const pool = sharedCandidates.length > 0 ? sharedCandidates : scored;
    return pool[Math.floor(Math.random() * Math.min(pool.length, 3))];
  }, []);

  const joinChat = useCallback(async (channelId: string, peerId: string, interests: string[] = []) => {
    isActionPending.current = true;
    clearFallbackTimer();
    await cleanupLobby();

    safeSetStatus('matched');
    safeSetStrangerName('Stranger');
    safeSetPeerInterests(normalizeInterests(interests));
    safeSetSearchHint('Matched. Keep it text-only and be cool.');
    currentPeerIdRef.current = peerId;

    const ably = ablyRef.current;
    if (!ably) {
      safeSetStatus('idle');
      isActionPending.current = false;
      return;
    }

    try {
      await cleanupChat();
      const chatChannel = ably.channels.get(channelId);
      chatChannelRef.current = chatChannel;

      chatChannel.presence.subscribe('leave', (member) => {
        if (member.clientId !== ably.auth.clientId) {
          currentPeerIdRef.current = null;
          safeSetStatus('idle');
          safeSetIsStrangerTyping(false);
          addSystemMessage('Stranger has disconnected.', 'warning');
          void cleanupChat();
        }
      });

      chatChannel.subscribe('message', (msg) => {
        if (msg.connectionId !== ably.connection.id) {
          const cleaned = sanitizeMessage(msg.data?.text || '');
          if (!cleaned) return;

          safeSetMessages((prev) => [...prev, {
            id: msg.id || createId('msg'),
            text: cleaned,
            sender: 'stranger',
            timestamp: msg.timestamp || Date.now(),
          }]);
          safeSetIsStrangerTyping(false);
          resetIdleTimer();
        }
      });

      chatChannel.subscribe('typing', (msg) => {
        if (msg.connectionId !== ably.connection.id) {
          safeSetIsStrangerTyping(!!msg.data?.isTyping);
        }
      });

      await chatChannel.presence.enter({ interests: optionsRef.current.interests });
      const shared = getSharedInterests(optionsRef.current.interests, interests);
      addSystemMessage(
        shared.length > 0
          ? `Stranger found through ${shared.map((id) => STRANGER_INTERESTS.find((interest) => interest.id === id)?.label || id).join(', ')}.`
          : 'Stranger found. Say hi.',
        'success'
      );
      addSystemMessage(`Icebreaker: ${getRandomStarter()}`);
      resetIdleTimer();
    } catch (e: any) {
      console.warn('Chat session error:', e.message);
      safeSetStatus('idle');
      addSystemMessage('Chat session failed. Try searching again.', 'danger');
    } finally {
      isActionPending.current = false;
    }
  }, [addSystemMessage, cleanupChat, cleanupLobby, clearFallbackTimer, resetIdleTimer, safeSetIsStrangerTyping, safeSetMessages, safeSetPeerInterests, safeSetSearchHint, safeSetStatus, safeSetStrangerName]);

  const attemptMatch = useCallback(async (allowRandomFallback = false) => {
    const ably = ablyRef.current;
    const lobby = lobbyChannelRef.current;
    if (!ably || !lobby || alreadyMatchedRef.current || statusRef.current !== 'searching') return;

    try {
      const presenceSet = await lobby.presence.get();
      const candidate = chooseCandidate(presenceSet, allowRandomFallback);

      if (!candidate) {
        safeSetSearchHint(
          optionsRef.current.matchMode === 'shared' && !allowRandomFallback
            ? 'Looking for shared interests. We will widen the search shortly.'
            : 'Waiting for another anonymous coder...'
        );
        return;
      }

      alreadyMatchedRef.current = true;
      const matchId = createId('match');
      const channel = `genjutsu_stranger_chat_${matchId}`;
      const payload: OfferPayload = {
        target: candidate.member.clientId,
        targetSearchId: candidate.data.searchId,
        fromClientId: ably.auth.clientId,
        channel,
        matchId,
        interests: optionsRef.current.interests,
        matchMode: optionsRef.current.matchMode,
        offeredAt: Date.now(),
      };

      await lobby.publish('offer', payload);
      await joinChat(channel, candidate.member.clientId, candidate.data.interests || []);
    } catch (e: any) {
      console.warn('Match attempt failed:', e.message);
      safeSetSearchHint('Matchmaking hiccup. Still listening...');
    }
  }, [chooseCandidate, joinChat, safeSetSearchHint]);

  useEffect(() => {
    mountedRef.current = true;
    const config = getConfig();

    const clientId = getOrCreateClientId();

    const clientOptions: any = { clientId };

    if (import.meta.env.DEV) {
      const ABLY_KEY = config.VITE_ABLY_KEY;
      if (!ABLY_KEY) {
        console.error('VITE_ABLY_KEY is missing in local .env.');
        safeSetConnectionState('failed');
        safeSetMessages([{ id: 'error', text: 'Configuration error: realtime connection failed.', sender: 'system', timestamp: Date.now(), tone: 'danger' }]);
        return;
      }
      clientOptions.key = ABLY_KEY;
    } else {
      const workerUrlPattern = import.meta.env.VITE_CONFIG_WORKER_URL || 'https://genjutsu-config.workers.dev/config';
      const base = new URL(workerUrlPattern);
      base.pathname = '/ably-auth';
      base.searchParams.set('clientId', clientId);
      clientOptions.authUrl = base.toString();
    }

    const client = new Ably.Realtime(clientOptions);
    ablyRef.current = client;

    client.connection.on((stateChange) => {
      safeSetConnectionState(stateChange.current as StrangerConnectionState);
      if (stateChange.current === 'failed' || stateChange.current === 'suspended') {
        safeSetSearchHint('Realtime connection is unstable. Messages may pause.');
      }
    });

    const globalChannel = client.channels.get(GLOBAL_CHANNEL);
    globalChannelRef.current = globalChannel;
    globalChannel.presence.enter({ page: 'stranger', at: Date.now() }).catch(() => {});

    const updateCount = async () => {
      try {
        const presence = await globalChannel.presence.get();
        safeSetOnlineCount(Math.max(1, presence.length));
      } catch (e) {
        /* ignore presence count issues */
      }
    };

    globalChannel.presence.subscribe(['enter', 'leave'], updateCount);
    updateCount();

    return () => {
      mountedRef.current = false;
      void cleanupLobby();
      void cleanupChat();
      try {
        globalChannel.presence.leave().catch(() => {});
        globalChannel.presence.unsubscribe();
        client.connection.off();
        client.close();
      } catch (e) {
        /* connection may already be gone */
      }
    };
  }, [cleanupChat, cleanupLobby, safeSetConnectionState, safeSetMessages, safeSetOnlineCount, safeSetSearchHint]);

  useEffect(() => {
    if (status === 'matched') resetIdleTimer();
    return () => clearIdleTimer();
  }, [clearIdleTimer, resetIdleTimer, status]);

  const startSearch = useCallback(async (options: StrangerSearchOptions = { interests: [], matchMode: 'random' }) => {
    if (!ablyRef.current || isActionPending.current) return;

    isActionPending.current = true;
    alreadyMatchedRef.current = false;
    fallbackWidenedRef.current = false;
    searchIdRef.current = createId('search');

    const normalizedOptions = {
      interests: normalizeInterests(options.interests),
      matchMode: options.matchMode,
    };
    optionsRef.current = normalizedOptions;

    safeSetCurrentOptions(normalizedOptions);
    safeSetStatus('searching');
    safeSetMessages([]);
    safeSetStrangerName('Stranger');
    safeSetIsStrangerTyping(false);
    safeSetPeerInterests([]);
    safeSetSearchHint(normalizedOptions.matchMode === 'shared' ? 'Scanning for shared interests...' : 'Looking for a random stranger...');

    const ably = ablyRef.current;

    try {
      await cleanupChat();
      await cleanupLobby();

      const lobby = ably.channels.get(LOBBY_CHANNEL);
      lobbyChannelRef.current = lobby;
      lobby.unsubscribe();

      lobby.subscribe('offer', (msg) => {
        const data = msg.data as OfferPayload;
        if (alreadyMatchedRef.current) return;
        if (data.target !== ably.auth.clientId) return;
        if (data.targetSearchId !== searchIdRef.current) return;
        if (blockedPeersRef.current.has(data.fromClientId)) return;

        alreadyMatchedRef.current = true;
        void joinChat(data.channel, data.fromClientId, data.interests || []);
      });

      lobby.presence.subscribe(['enter', 'update'], () => {
        void attemptMatch(fallbackWidenedRef.current);
      });

      await lobby.presence.enter({
        searching: true,
        interests: normalizedOptions.interests,
        matchMode: normalizedOptions.matchMode,
        startedAt: Date.now(),
        searchId: searchIdRef.current,
        version: 2,
      } satisfies LobbyPresenceData);

      await attemptMatch(false);

      clearFallbackTimer();
      if (!alreadyMatchedRef.current) {
        fallbackTimerRef.current = setTimeout(() => {
          fallbackWidenedRef.current = true;
          safeSetSearchHint('Widening search so you are not stuck in the void...');
          void attemptMatch(true);
        }, normalizedOptions.matchMode === 'shared' ? SHARED_MATCH_FALLBACK_MS : 2500);
      }
    } catch (e: any) {
      console.warn('Matchmaking initialization error:', e.message);
      safeSetStatus('idle');
      addSystemMessage('Could not enter the Stranger lobby. Try again.', 'danger');
    } finally {
      isActionPending.current = false;
    }
  }, [addSystemMessage, attemptMatch, cleanupChat, cleanupLobby, clearFallbackTimer, joinChat, safeSetCurrentOptions, safeSetIsStrangerTyping, safeSetMessages, safeSetPeerInterests, safeSetSearchHint, safeSetStatus, safeSetStrangerName]);

  const sendMessage = useCallback((text: string) => {
    const cleaned = sanitizeMessage(text);
    if (!cleaned || !chatChannelRef.current || status !== 'matched') return { ok: false, reason: 'not_ready' };

    const now = Date.now();
    const remainingCooldown = MIN_MESSAGE_INTERVAL_MS - (now - lastMessageAtRef.current);
    if (remainingCooldown > 0) {
      return { ok: false, reason: 'cooldown', remainingMs: remainingCooldown };
    }

    lastMessageAtRef.current = now;
    chatChannelRef.current.publish('message', { text: cleaned }).catch(() => {
      addSystemMessage('Message failed to send. Check your realtime connection.', 'danger');
    });
    safeSetMessages((prev) => [...prev, { id: createId('me'), text: cleaned, sender: 'me', timestamp: now }]);
    resetIdleTimer();
    return { ok: true, text: cleaned };
  }, [addSystemMessage, resetIdleTimer, safeSetMessages, status]);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (status === 'matched' && chatChannelRef.current) {
      chatChannelRef.current.publish('typing', { isTyping }).catch(() => {});
    }
  }, [status]);

  const stopSearch = useCallback(async (message = 'You disconnected.') => {
    if (isActionPending.current) return;
    isActionPending.current = true;

    try {
      await cleanupLobby();
      await cleanupChat();
    } finally {
      alreadyMatchedRef.current = false;
      currentPeerIdRef.current = null;
      safeSetStatus('idle');
      safeSetIsStrangerTyping(false);
      safeSetPeerInterests([]);
      safeSetSearchHint('Ready for anonymous text chat.');
      addSystemMessage(message, 'warning');
      isActionPending.current = false;
    }
  }, [addSystemMessage, cleanupChat, cleanupLobby, safeSetIsStrangerTyping, safeSetPeerInterests, safeSetSearchHint, safeSetStatus]);

  const skip = useCallback(async () => {
    if (currentPeerIdRef.current) {
      blockedPeersRef.current.add(currentPeerIdRef.current);
      safeSetBlockedCount(blockedPeersRef.current.size);
    }
    const options = optionsRef.current;
    await stopSearch('You skipped this stranger. Searching again...');
    await startSearch(options);
  }, [safeSetBlockedCount, startSearch, stopSearch]);

  const reportAndSkip = useCallback(async () => {
    if (currentPeerIdRef.current) {
      blockedPeersRef.current.add(currentPeerIdRef.current);
      safeSetBlockedCount(blockedPeersRef.current.size);
    }
    addSystemMessage('This stranger was avoided for this browser session. No report was stored.', 'warning');
    const options = optionsRef.current;
    await stopSearch('Safety skip activated. Searching for someone else...');
    await startSearch(options);
  }, [addSystemMessage, safeSetBlockedCount, startSearch, stopSearch]);

  const clearMessages = useCallback(() => {
    safeSetMessages([]);
    addSystemMessage('Local chat cleared. The session is still active.', 'default');
  }, [addSystemMessage, safeSetMessages]);

  return {
    status,
    messages,
    sendMessage,
    startSearch,
    stopSearch,
    skip,
    reportAndSkip,
    clearMessages,
    strangerName,
    onlineCount,
    isStrangerTyping,
    sendTypingIndicator,
    connectionState,
    searchHint,
    peerInterests,
    currentOptions,
    blockedCount,
    maxMessageLength: MAX_MESSAGE_LENGTH,
  };
}
