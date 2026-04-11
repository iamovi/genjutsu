import { Home, Search, User, LogOut, Settings, Hash, X, Send, Swords, UsersRound, LogIn, Bell, Shield, Menu } from "lucide-react";
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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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

  // Prevent body scrolling when mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isDrawerOpen]);

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
            <div className="w-8 h-8 rounded-[3px] overflow-hidden">
              <img src="/logo.webp" alt="genjutsu" width={32} height={32} className="w-full h-full object-contain" />
            </div>
            <span className="font-black text-lg tracking-tight text-primary">genjutsu</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { icon: Home, label: t("nav.feed"), path: "/" },
              { icon: Search, label: t("nav.search"), path: "/search" },
              { icon: Send, label: t("nav.whispers"), path: "/whispers" },
              { icon: UsersRound, label: t("nav.stranger"), path: "/stranger" },
              { icon: Swords, label: t("nav.play"), path: "/play" },
            ].map(({ icon: Icon, label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-[3px] text-sm font-medium transition-all gum-border ${location.pathname === path
                  ? "bg-primary text-primary-foreground gum-shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Icon size={16} />
                {label}
                {path === "/whispers" && hasUnreadWhispers && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:block">
              <ModeToggle />
            </div>

            {/* Mobile: Search button */}
            <button
              onClick={() => navigate("/search")}
              className="md:hidden p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-muted-foreground transition-colors gum-border"
              title="Search"
            >
              <Search size={16} />
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
                      <span>{t("nav.admin")}</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      if (profile?.username) {
                        navigate(`/u/${profile.username}`);
                      }
                    }}
                    className={`cursor-pointer ${!profile?.username ? 'opacity-50' : ''}`}
                    disabled={!profile?.username}
                  >
                    <User className="mr-2 h-4 w-4" />
                    <span>{profile?.username ? t("nav.profile") : 'Loading...'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => navigate("/settings")} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t("nav.settings")}</span>
                  </DropdownMenuItem>
                  <div className="sm:hidden">
                    <DropdownMenuItem onClick={(e) => e.preventDefault()} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Hash className="mr-2 h-4 w-4" />
                        <span>{t("nav.theme")}</span>
                      </div>
                      <ModeToggle />
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => navigate("/auth")}
                className="p-1.5 sm:px-4 sm:py-1.5 rounded-[3px] gum-border bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline font-bold">{t("nav.signIn")}</span>
              </button>
            )}

            {/* Mobile: Menu button — md:hidden */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="md:hidden p-1.5 sm:p-2 rounded-[3px] hover:bg-secondary text-muted-foreground transition-colors gum-border"
              title="Menu"
            >
              <Menu size={16} />
            </button>
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
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] md:hidden"
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-[280px] bg-background border-l-2 border-border z-[70] md:hidden overflow-y-auto"
              >
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b-2 border-border bg-secondary/30">
                  <span className="font-black tracking-tight text-lg uppercase">{t("nav.menu")}</span>
                  <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 hover:bg-secondary rounded-[3px] transition-colors gum-border bg-background shadow-sm active:translate-y-px">
                    <X size={16} />
                  </button>
                </div>

                <div className="p-4 space-y-5">
                  {/* User Profile */}
                  {user && profile && (
                    <button
                      onClick={() => { if (profile?.username) { navigate(`/u/${profile.username}`); setIsDrawerOpen(false); } }}
                      className="flex items-center gap-3 w-full hover:bg-secondary rounded-[3px] p-2 -mx-2 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                        ) : initials}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold leading-none">{profile?.display_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">@{profile?.username}</p>
                      </div>
                    </button>
                  )}

                  {/* NAVIGATE */}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2 px-1">{t("nav.navigate")}</p>
                    <div className="space-y-0.5">
                      {[
                        { icon: Home, label: t("nav.feed"), path: "/" },
                        { icon: Send, label: t("nav.whispers"), path: "/whispers" },
                        { icon: UsersRound, label: t("nav.stranger"), path: "/stranger" },
                        { icon: Swords, label: t("nav.play"), path: "/play" },
                      ].map(({ icon: Icon, label, path }) => (
                        <button
                          key={path}
                          onClick={() => {
                            navigate(path); setIsDrawerOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-sm font-medium transition-colors ${location.pathname === path
                            ? "bg-primary/10 text-primary font-bold"
                            : "hover:bg-secondary text-foreground"
                            }`}
                        >
                          <div className="relative">
                            <Icon size={16} className={location.pathname === path ? "text-primary" : "text-muted-foreground"} />
                            {path === "/whispers" && hasUnreadWhispers && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
                            )}
                          </div>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ACCOUNT */}
                  {user && (
                    <div>
                      <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2 px-1">{t("nav.account")}</p>
                      <div className="space-y-0.5">
                        {isAdmin && (
                          <button
                            onClick={() => { navigate("/admin"); setIsDrawerOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-sm font-medium hover:bg-secondary transition-colors"
                          >
                            <Shield size={16} className="text-muted-foreground" />
                            {t("nav.admin")}
                          </button>
                        )}
                        <button
                          onClick={() => { if (profile?.username) { navigate(`/u/${profile.username}`); setIsDrawerOpen(false); } }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-sm font-medium hover:bg-secondary transition-colors"
                        >
                          <User size={16} className="text-muted-foreground" />
                          {t("nav.profile")}
                        </button>
                        <button
                          onClick={() => { navigate("/settings"); setIsDrawerOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[3px] text-sm font-medium hover:bg-secondary transition-colors"
                        >
                          <Settings size={16} className="text-muted-foreground" />
                          {t("nav.settings")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DISCOVERY */}
                  <div>
                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2 px-1">{t("nav.discovery")}</p>
                    <Sidebar onAction={() => setIsDrawerOpen(false)} />
                  </div>

                  {/* Footer */}
                  <div className="border-t-2 border-border pt-4 flex items-center justify-between">
                    <ModeToggle />
                    {user && (
                      <button
                        onClick={() => { signOut(); setIsDrawerOpen(false); }}
                        className="flex items-center gap-2 text-sm font-bold text-destructive hover:underline"
                      >
                        <LogOut size={14} />
                        {t("nav.signOut")}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )
        }
      </AnimatePresence>
    </>
  );
};

export default Navbar;
