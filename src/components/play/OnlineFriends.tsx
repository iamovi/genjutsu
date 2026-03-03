import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Users, Loader2 } from 'lucide-react';
import { OnlinePlayer } from '@/hooks/usePlayPresence';

interface OnlineFriendsProps {
    friends: OnlinePlayer[];
    others: OnlinePlayer[];
    totalOnline: number;
    onChallenge: (player: OnlinePlayer) => void;
    challengingUserId: string | null;
}

const OnlineFriends = ({ friends, others, totalOnline, onChallenge, challengingUserId }: OnlineFriendsProps) => {
    const allVisible = [...friends, ...others];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass glass-border rounded-2xl p-5 glow-sm"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold">Online Now</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-xs text-muted-foreground">{totalOnline} online</span>
                </div>
            </div>

            {allVisible.length === 0 ? (
                <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground/60">No friends online right now</p>
                    <p className="text-xs text-muted-foreground/40 mt-1">Use a room code to play with anyone</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {friends.length > 0 && (
                            <motion.p
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 mb-1"
                            >
                                Friends
                            </motion.p>
                        )}
                        {friends.map((player) => (
                            <PlayerRow
                                key={player.user_id}
                                player={player}
                                onChallenge={onChallenge}
                                isChallenging={challengingUserId === player.user_id}
                            />
                        ))}
                        {others.length > 0 && (
                            <motion.p
                                layout
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest px-1 mt-3 mb-1"
                            >
                                Others on Play
                            </motion.p>
                        )}
                        {others.map((player) => (
                            <PlayerRow
                                key={player.user_id}
                                player={player}
                                onChallenge={onChallenge}
                                isChallenging={challengingUserId === player.user_id}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
    );
};

interface PlayerRowProps {
    player: OnlinePlayer;
    onChallenge: (player: OnlinePlayer) => void;
    isChallenging: boolean;
}

const PlayerRow = ({ player, onChallenge, isChallenging }: PlayerRowProps) => (
    <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors group"
    >
        <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center font-bold text-xs overflow-hidden border border-border/50">
                {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" />
                ) : (
                    player.display_name.substring(0, 2).toUpperCase()
                )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/50" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-card" />
            </span>
        </div>

        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{player.display_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">@{player.username}</p>
        </div>

        <button
            onClick={() => onChallenge(player)}
            disabled={isChallenging}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-wait"
        >
            {isChallenging ? (
                <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Waiting...</span>
                </>
            ) : (
                <>
                    <Swords className="h-3 w-3" />
                    <span>Challenge</span>
                </>
            )}
        </button>
    </motion.div>
);

export default OnlineFriends;
