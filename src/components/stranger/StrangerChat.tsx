import { useState, useRef } from "react";
import { useStrangerMatch } from "./useStrangerMatch";
import { MessageList } from "./MessageList";
import { Send, UserRoundX, Orbit } from "lucide-react";

export const StrangerChat = () => {
  const { status, messages, sendMessage, startSearch, stopSearch, skip, strangerName, onlineCount, isStrangerTyping, sendTypingIndicator } = useStrangerMatch();
  const [text, setText] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    
    if (status === 'matched') {
       sendTypingIndicator(true);
       if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
       typingTimeoutRef.current = setTimeout(() => sendTypingIndicator(false), 2000);
    }
  };

  const handleSend = () => {
    if (!text.trim() || status !== 'matched') return;
    sendMessage(text.trim());
    setText("");
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingIndicator(false);
  };

  return (
    <div className="flex border-2 border-border flex-col flex-1 w-full bg-background gum-card overflow-hidden shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_theme(colors.border)] mb-4 lg:mb-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b-2 border-border bg-secondary/30">
        <div className="flex items-center gap-3">
           <div className={`w-3 h-3 rounded-full border-2 border-background shadow-sm shrink-0 ${status === 'matched' ? 'bg-green-500 animate-pulse' : status === 'searching' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`} />
           <div className="flex flex-col">
               <h2 className="font-bold tracking-tighter truncate text-sm sm:text-base whitespace-nowrap overflow-hidden leading-tight">
                  {status === 'idle' ? 'Stranger Lobby' : status === 'searching' ? 'Searching for a stranger...' : `Chatting with ${strangerName}`}
               </h2>
               {status === 'idle' && (
                  <span className="text-[10px] text-muted-foreground font-bold tracking-tight">
                     <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                     {onlineCount} {onlineCount === 1 ? 'coder' : 'coders'} online now
                  </span>
               )}
           </div>
        </div>
        
        {status !== 'idle' && (
           <button 
             onClick={stopSearch}
             className="text-xs font-bold text-destructive hover:underline"
           >
             Disconnect
           </button>
        )}
      </div>

      {/* Body */}
      {status === 'idle' && messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 space-y-4 sm:space-y-6 text-center overflow-y-auto min-h-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-[3px] gum-border bg-primary/10 flex items-center justify-center text-primary shadow-[4px_4px_0px_#000] dark:shadow-[4px_4px_0px_theme(colors.primary.DEFAULT)]">
               <Orbit size={32} className="sm:w-10 sm:h-10" />
            </div>
            <div>
               <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2 sm:mb-3">Talk to Strangers</h3>
               <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  You will be instantly matched with another random developer. Chats are completely anonymous, ephemeral, and vanish instantly when you disconnect.
               </p>
            </div>
            <button
               onClick={startSearch}
               className="gum-btn block shrink-0 bg-primary text-primary-foreground font-extrabold px-6 py-2.5 sm:px-8 sm:py-3.5 w-full max-w-[200px] sm:max-w-xs transition-transform hover:translate-x-1 hover:-translate-y-1 shadow-[4px_4px_0px_theme(colors.primary.DEFAULT)]"
            >
               Start Searching
            </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col h-full bg-secondary/5">
            {status === 'searching' ? (
               <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                  <Orbit className="animate-spin mb-4 text-primary opacity-50" size={48} />
                  <p className="font-bold tracking-widest uppercase text-xs">Waiting in lobby...</p>
               </div>
            ) : (
               <MessageList messages={messages} isStrangerTyping={isStrangerTyping} />
            )}
            
            {/* Input Area */}
            {status === 'idle' && messages.length > 0 ? (
               <div className="p-4 bg-background border-t-2 border-border flex justify-center">
                   <button 
                     onClick={startSearch}
                     className="gum-btn w-full sm:w-auto bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-transform font-bold px-8 py-3 rounded-[3px] shadow-[4px_4px_0px_theme(colors.primary.DEFAULT)] dark:shadow-[4px_4px_0px_#000]"
                   >
                     Find a new Stranger
                   </button>
               </div>
            ) : (
               <div className={`p-4 bg-background border-t-2 border-border ${status !== 'matched' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex gap-1.5 sm:gap-2 relative">
                      <button 
                        onClick={skip}
                        className="flex shrink-0 items-center justify-center gap-1 bg-destructive text-destructive-foreground px-3 sm:px-4 py-2 rounded-[3px] font-bold text-sm gum-btn hover:bg-red-600 transition-colors"
                      >
                       <UserRoundX size={16} />
                       <span className="hidden sm:inline">Skip</span>
                     </button>

                     <input
                       type="text"
                       value={text}
                       onChange={handleInputChange}
                       onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                       placeholder="Type a message..."
                       className="flex-1 min-w-0 bg-background border-2 border-border rounded-[3px] px-2 sm:px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50 transition-all font-mono"
                       disabled={status !== 'matched'}
                     />
                     
                     <button 
                       onClick={handleSend}
                       disabled={status !== 'matched' || !text.trim()}
                       className="bg-primary shrink-0 text-primary-foreground p-2 px-3 sm:px-6 rounded-[3px] gum-btn disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
                     >
                       <Send size={18} />
                     </button>
                  </div>
               </div>
            )}
        </div>
      )}
    </div>
  );
};
