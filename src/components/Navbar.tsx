import { Eye, Home, Search, Bell, User, LogOut, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ModeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const initials = profile?.display_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b-2 border-border"
    >
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[3px] overflow-hidden gum-border">
            <img src="/fav.jpg" alt="genjutsu" className="w-full h-full object-cover" />
          </div>
          <span className="font-bold text-lg tracking-tight">genjutsu</span>
        </button>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { icon: Home, label: "Feed", active: true },
          ].map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              onClick={() => navigate("/")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${active
                ? "bg-primary text-primary-foreground gum-shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          {user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(`/${profile?.username}`)}
                className="flex items-center gap-2 group"
              >
                <div className="hidden sm:flex flex-col items-end mr-1">
                  <span className="text-sm font-bold group-hover:underline leading-none">{profile?.display_name}</span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-1">@{profile?.username}</span>
                </div>
                <div className="w-8 h-8 rounded-[3px] gum-border bg-secondary flex items-center justify-center font-bold text-xs overflow-hidden">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : initials}
                </div>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground gum-border"
                    title="Settings"
                  >
                    <Settings size={18} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 gum-border">
                  <DropdownMenuItem onClick={() => navigate(`/${profile?.username}`)} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="gum-btn bg-primary text-primary-foreground text-sm"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </motion.header >
  );
};

export default Navbar;
