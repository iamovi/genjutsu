import { StrangerChat } from "@/components/stranger/StrangerChat";
import { UsersRound, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ModeToggle";
import { Helmet } from "react-helmet-async";

const StrangerPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Stranger Beta | genjutsu</title>
        <meta name="description" content="Meet fellow developers securely and entirely anonymously via real-time WebSockets." />
      </Helmet>
      <div className="flex flex-col h-[100dvh] w-full animate-in fade-in zoom-in-95 duration-500 bg-background/50">
        <div className="flex-1 w-full max-w-6xl mx-auto p-2 sm:p-4 md:p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-3 sm:mb-4 px-1 relative">
            <button 
              onClick={() => navigate(-1)}
              className="flex relative z-10 items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold text-muted-foreground hover:text-foreground gum-btn px-2.5 sm:px-3 py-1.5 border border-border bg-background hover:bg-secondary rounded-[3px] transition-all w-fit shadow-[2px_2px_0_theme(colors.border)] active:translate-y-[2px] active:shadow-none"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <h1 className="flex-1 flex justify-center text-lg sm:text-2xl font-black tracking-tight items-center gap-1.5 sm:gap-2 whitespace-nowrap overflow-hidden">
              <UsersRound className="text-primary hidden sm:block shrink-0" size={24} />
              <span className="truncate">Stranger</span> 
              <span className="bg-primary shrink-0 text-primary-foreground text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-[3px] tracking-widest uppercase align-middle gum-border ml-0.5 -rotate-2">Beta</span>
            </h1>

            <div className="relative z-10">
              <ModeToggle />
            </div>
          </div>

          <StrangerChat />
        </div>
      </div>
    </>
  );
};

export default StrangerPage;
