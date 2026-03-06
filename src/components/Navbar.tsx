import { Home, Search, User, LogOut, Settings, Hash, X, Send, Swords, LogIn, Bell, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/ModeToggle";
import { useState, useRef, useEffect } from "react";
import Sidebar from "./Sidebar";
import NotificationPanel from "./NotificationPanel";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnreadWhispers } from "@/hooks/useUnreadWhispers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const notifRef = useRef<HTMLDivElement>(null);
  const { hasUnread: hasUnreadWhispers } = useUnreadWhispers();

  // Close notification panel on outside click
  useEffect(() => {
    if (!isNotifOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isNotifOpen]);

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b-2 border-border"
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <div className="w-8 h-8 rounded-[3px] overflow-hidden gum-border">
              <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">genjutsu</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { icon: Home, label: "Feed", path: "/" },
              { icon: Search, label: "Search", path: "/search" },
              { icon: Send, label: "Whispers", path: "/whispers" },
              { icon: Swords, label: "Play", path: "/play" },
            ].map(({ icon: Icon, label, path }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-[3px] text-sm font-medium transition-all ${location.pathname === path
                  ? "bg-primary text-primary-foreground gum-shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Icon size={16} />
                {label}
                {label === "Whispers" && hasUnreadWhispers && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-4">
            <div className="hidden sm:block">
              <ModeToggle />
            </div>
            <button
              onClick={() => navigate("/")}
              className="md:hidden p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-muted-foreground transition-colors gum-border"
              title="Feed"
            >
              <Home size={16} />
            </button>
            <button
              onClick={() => navigate("/search")}
              className="md:hidden p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-muted-foreground transition-colors gum-border"
              title="Search"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => navigate("/play")}
              className="md:hidden p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-muted-foreground transition-colors gum-border"
              title="Play"
            >
              <Swords size={16} />
            </button>
            <button
              onClick={() => navigate("/whispers")}
              className="md:hidden relative p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-muted-foreground transition-colors gum-border"
              title="Whispers"
            >
              <Send size={16} />
              {hasUnreadWhispers && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="lg:hidden p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-primary transition-colors gum-border"
              title="Discovery"
            >
              <Hash size={16} />
            </button>

            {/* Notification Bell */}
            {user && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className={`relative p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary transition-colors gum-border ${isNotifOpen ? "bg-secondary text-foreground" : "text-muted-foreground"
                    }`}
                  title="Notifications"
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="fixed left-4 right-4 sm:absolute sm:left-auto sm:right-0 sm:w-[360px] top-[60px] sm:top-full sm:mt-2 z-[80] gum-card bg-background shadow-xl overflow-hidden"
                    >
                      <NotificationPanel
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkAsRead={markAsRead}
                        onMarkAllAsRead={markAllAsRead}
                        onClose={() => setIsNotifOpen(false)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 sm:gap-2 group">
                    <div className="hidden md:flex flex-col items-end mr-1">
                      <span className="text-sm font-bold group-hover:underline leading-none">{profile?.display_name}</span>
                      <span className="text-[10px] text-muted-foreground leading-none mt-1">@{profile?.username}</span>
                    </div>
                    <div className="w-8 h-8 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-xs overflow-hidden transition-transform group-hover:scale-105 group-active:scale-95">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 gum-border text-xs sm:text-sm">
                  <div className="px-2 py-1.5 md:hidden border-b border-border mb-1">
                    <p className="text-sm font-bold truncate">{profile?.display_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">@{profile?.username}</p>
                  </div>
                  {isAdmin && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Admin</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate(`/${profile?.username}`)} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <div className="sm:hidden">
                    <DropdownMenuItem onClick={(e) => e.preventDefault()} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Theme</span>
                      </div>
                      <ModeToggle />
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="gum-btn bg-primary text-primary-foreground text-xs sm:text-sm px-2.5 sm:px-5 py-1.5 sm:py-2.5 flex items-center gap-2 whitespace-nowrap"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}
          </div>
        </div>
      </motion.header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {
          isDrawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] lg:hidden"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[280px] bg-background border-l-2 border-border z-[70] p-6 lg:hidden overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="font-bold tracking-tighter text-xl">Discovery</span>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-secondary rounded-[3px] transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <Sidebar onAction={() => setIsDrawerOpen(false)} />
              </motion.div>
            </>
          )
        }
      </AnimatePresence >
    </>
  );
};

export default Navbar;
