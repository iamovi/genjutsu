import { Heart, HeartOff, MessageSquare, MessageCircleOff, UserPlus, UserMinus, Check, Bell, AtSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { NotificationWithActor } from "@/hooks/useNotifications";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationPanelProps {
    notifications: NotificationWithActor[];
    unreadCount: number;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => void;
    onClose: () => void;
}

function getNotificationIcon(type: string) {
    switch (type) {
        case "like":
            return <Heart size={14} className="text-red-500" />;
        case "unlike":
            return <HeartOff size={14} className="text-muted-foreground" />;
        case "comment":
            return <MessageSquare size={14} className="text-blue-500" />;
        case "uncomment":
            return <MessageCircleOff size={14} className="text-muted-foreground" />;
        case "follow":
            return <UserPlus size={14} className="text-green-500" />;
        case "unfollow":
            return <UserMinus size={14} className="text-destructive" />;
        case "mention":
            return <AtSign size={14} className="text-purple-500" />;
        default:
            return <Bell size={14} />;
    }
}

function getNotificationText(type: string, actorName: string) {
    switch (type) {
        case "like":
            return <><strong>{actorName}</strong> resonated with your post</>;
        case "unlike":
            return <><strong>{actorName}</strong> stopped resonating with your post</>;
        case "comment":
            return <><strong>{actorName}</strong> echoed on your post</>;
        case "uncomment":
            return <><strong>{actorName}</strong> erased their echo on your post</>;
        case "follow":
            return <><strong>{actorName}</strong> started following you</>;
        case "unfollow":
            return <><strong>{actorName}</strong> stopped following you</>;
        case "mention":
            return <><strong>{actorName}</strong> mentioned you in a void</>;
        default:
            return <><strong>{actorName}</strong> interacted with you</>;
    }
}

const NotificationPanel = ({
    notifications,
    unreadCount,
    onMarkAsRead,
    onMarkAllAsRead,
    onClose,
}: NotificationPanelProps) => {
    const navigate = useNavigate();

    const handleClick = (notification: NotificationWithActor) => {
        if (!notification.is_read) {
            onMarkAsRead(notification.id);
        }

        if (notification.type === "follow" && notification.actor_profile) {
            navigate(`/u/${notification.actor_profile.username}`);
        } else if (notification.post_id) {
            navigate(`/post/${notification.post_id}`);
        }

        onClose();
    };

    return (
        <div className="w-full sm:w-[360px] max-h-[420px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b-2 border-border">
                <h3 className="font-bold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAllAsRead}
                        className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Check size={12} />
                        Mark all read
                    </button>
                )}
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4">
                        <Bell size={28} className="text-muted-foreground mb-2 opacity-40" />
                        <p className="text-xs text-muted-foreground text-center">No notifications yet.</p>
                        <p className="text-[10px] text-muted-foreground text-center mt-0.5 opacity-60">
                            When someone resonates with your posts, you'll see it here.
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {notifications.map((notification) => (
                            <motion.button
                                key={notification.id}
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                onClick={() => handleClick(notification)}
                                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors border-b border-border/50 ${!notification.is_read ? "bg-primary/5" : ""
                                    }`}
                            >
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-xs overflow-hidden shrink-0 mt-0.5">
                                    {notification.actor_profile?.avatar_url ? (
                                        <img
                                            src={notification.actor_profile.avatar_url}
                                            alt={notification.actor_profile.username}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        notification.actor_profile?.display_name?.[0]?.toUpperCase() || "?"
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {getNotificationIcon(notification.type)}
                                        <p className="text-xs leading-snug">
                                            {getNotificationText(
                                                notification.type,
                                                notification.actor_profile?.display_name || "Someone"
                                            )}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(notification.created_at))} ago
                                    </p>
                                </div>

                                {/* Unread indicator */}
                                {!notification.is_read && (
                                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                )}
                            </motion.button>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default NotificationPanel;
