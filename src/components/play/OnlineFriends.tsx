import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Users } from "lucide-react";
import { FrogLoader } from "@/components/ui/FrogLoader";
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
            className="gum-card p-4 sm:p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-bold">Online Now</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
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
                                className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-1 mb-1"
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
                                className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest px-1 mt-3 mb-1"
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
        className="flex items-center gap-3 p-2.5 rounded-[3px] border-2 border-border bg-card hover:bg-secondary/40 transition-colors group"
    >
        <div className="relative">
            <div className="w-9 h-9 rounded-[3px] bg-secondary flex items-center justify-center font-bold text-xs overflow-hidden border-2 border-border">
                {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.username} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                    player.display_name.substring(0, 2).toUpperCase()
                )}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/50" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success border-2 border-card" />
            </span>
        </div>

        <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{player.display_name}</p>
            <p className="text-[11px] text-muted-foreground truncate">@{player.username}</p>
        </div>

        <button
            onClick={() => onChallenge(player)}
            disabled={isChallenging}
            className="gum-btn bg-primary text-primary-foreground text-[11px] px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
        >
            {isChallenging ? (
                <>
                    <FrogLoader className="h-3 w-3 " />
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
