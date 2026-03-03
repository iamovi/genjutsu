import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Swords, Plus, LogIn } from 'lucide-react';
import FloatingParticles from './FloatingParticles';
import OnlineFriends from './OnlineFriends';
import { OnlinePlayer } from '@/hooks/usePlayPresence';

interface HomeScreenProps {
  onCreateRoom: (name: string) => void;
  onJoinRoom: (code: string, name: string) => void;
  // Hybrid props (optional — gracefully degrade if not provided)
  isLoggedIn?: boolean;
  displayName?: string;
  onlineFriends?: OnlinePlayer[];
  onlineOthers?: OnlinePlayer[];
  totalOnline?: number;
  onChallenge?: (player: OnlinePlayer) => void;
  challengingUserId?: string | null;
}

const HomeScreen = ({
  onCreateRoom,
  onJoinRoom,
  isLoggedIn = false,
  displayName = '',
  onlineFriends = [],
  onlineOthers = [],
  totalOnline = 0,
  onChallenge,
  challengingUserId = null,
}: HomeScreenProps) => {
  const [nickname, setNickname] = useState(() => {
    // If logged in, prefer display name
    if (isLoggedIn && displayName) return displayName;
    return localStorage.getItem('genjutsu-play-name') || '';
  });
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'home' | 'join'>('home');

  const handleCreate = () => {
    if (!nickname.trim()) return;
    localStorage.setItem('genjutsu-play-name', nickname.trim());
    onCreateRoom(nickname.trim());
  };

  const handleJoin = () => {
    if (!nickname.trim() || roomCode.length < 6) return;
    localStorage.setItem('genjutsu-play-name', nickname.trim());
    onJoinRoom(roomCode.trim(), nickname.trim());
  };

  const hasOnlinePlayers = onlineFriends.length > 0 || onlineOthers.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Floating particles */}
      <FloatingParticles />
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-foreground/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-foreground/[0.02] rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-0 w-[300px] h-[300px] bg-foreground/[0.02] rounded-full blur-[80px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md space-y-6 text-center relative z-10"
      >
        {/* Logo */}
        <div className="space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="flex items-center justify-center gap-3"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-foreground/20 rounded-2xl blur-xl" />
              <div className="relative bg-card glass-border rounded-2xl p-3 text-primary">
                <Swords className="h-10 w-10" />
              </div>
            </div>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-black tracking-tight gradient-text"
          >
            GENJUTSU PLAY
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground text-sm"
          >
            {isLoggedIn ? 'Challenge your friends or play with anyone' : 'Play mini games with friends, peer-to-peer'}
          </motion.p>
        </div>

        {/* Online Friends Section (logged in only) */}
        {isLoggedIn && onChallenge && (
          <OnlineFriends
            friends={onlineFriends}
            others={onlineOthers}
            totalOnline={totalOnline}
            onChallenge={onChallenge}
            challengingUserId={challengingUserId}
          />
        )}

        {/* Divider (when both sections visible) */}
        {isLoggedIn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3"
          >
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground/50 font-medium">or play with room code</span>
            <div className="flex-1 h-px bg-border/50" />
          </motion.div>
        )}

        {/* Room Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isLoggedIn ? 0.45 : 0.35 }}
          className="glass glass-border rounded-2xl p-6 space-y-5 glow-sm"
        >
          {!isLoggedIn && (
            <Input
              placeholder="Enter your nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="h-13 text-center text-lg bg-secondary/60 border-border/50 focus:border-foreground/30 focus:glow-sm transition-all placeholder:text-muted-foreground/60"
            />
          )}

          {mode === 'home' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <Button
                onClick={handleCreate}
                disabled={!nickname.trim()}
                className="flex-1 h-14 text-base font-semibold gap-2 glow-sm hover:glow-md transition-shadow"
              >
                <Plus className="h-5 w-5" />
                Create Room
              </Button>
              <Button
                onClick={() => setMode('join')}
                variant="outline"
                disabled={!nickname.trim()}
                className="flex-1 h-14 text-base font-semibold gap-2 border-border/50 hover:bg-accent hover:border-foreground/20 transition-all"
              >
                <LogIn className="h-5 w-5" />
                Join Room
              </Button>
            </motion.div>
          )}

          {mode === 'join' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <Input
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="h-13 text-center text-xl font-mono tracking-[0.3em] bg-secondary/60 border-border/50 focus:border-foreground/30 transition-all placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setMode('home'); setRoomCode(''); }}
                  className="flex-1 h-12 border-border/50"
                >
                  Back
                </Button>
                <Button
                  onClick={handleJoin}
                  disabled={!roomCode.trim() || roomCode.length < 6}
                  className="flex-1 h-12 font-semibold glow-sm hover:glow-md transition-shadow"
                >
                  Join
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default HomeScreen;
