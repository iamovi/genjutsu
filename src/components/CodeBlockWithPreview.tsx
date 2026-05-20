import { useState } from "react";
import { Play, X } from "lucide-react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import vscDarkPlus from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { useTheme } from "@/components/theme-provider";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const LivePreviewModal = ({ code, language, isOpen, onOpenChange }: { code: string; language: string; isOpen: boolean; onOpenChange: (open: boolean) => void }) => {
  const getSrcDoc = () => {
    if (language === "html") return code;
    if (language === "css") return `<!DOCTYPE html><html><head><style>body{color:#333;font-family:sans-serif;}</style><style>${code}</style></head><body><div class="preview-text"><h2>Preview Element</h2><p>This is a test element to see your CSS.</p><button>Button</button></div></body></html>`;
    if (language === "javascript" || language === "js") return `<!DOCTYPE html><html><body><script>
      const oldLog = console.log;
      console.log = function(...args) {
        oldLog(...args);
        const div = document.createElement('div');
        div.style.fontFamily = 'monospace';
        div.style.fontSize = '14px';
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '8px';
        div.style.color = '#eee';
        div.innerText = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        document.body.appendChild(div);
      };
      document.body.style.backgroundColor = '#1e1e1e';
      try {
        ${code}
      } catch(e) {
        console.log("Error:", e.message);
      }
    </script></body></html>`;
    return "";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="left-0 top-0 translate-x-0 translate-y-0 w-screen h-[100dvh] max-w-none max-h-none rounded-none p-0 border-none bg-background shadow-none outline-none overflow-hidden [&>button:last-child]:hidden flex flex-col">
        <DialogTitle className="sr-only">Live Code Preview</DialogTitle>
        <DialogDescription className="sr-only">Fullscreen execution preview of code block</DialogDescription>
        
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary shrink-0">
          <div className="font-bold uppercase text-xs tracking-wider flex items-center gap-2">
            <Play size={14} className="text-primary" /> Live Output
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-[3px] bg-background/50 hover:bg-destructive hover:text-destructive-foreground transition-colors flex items-center gap-1 text-xs font-medium"
          >
            <X size={14} /> Close
          </button>
        </div>
        
        <div className="flex-1 w-full bg-white relative">
          <iframe
            srcDoc={getSrcDoc()}
            sandbox="allow-scripts allow-popups"
            className="w-full h-full border-none absolute inset-0"
            title="Live Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const CodeBlockWithPreview = ({ 
    code, 
    language, 
    isExpanded, 
    onToggleExpand, 
    isLongCode, 
    truncatedCode,
    isMarkdown = false,
    ...props
}: any) => {
    const [showPreview, setShowPreview] = useState(false);
    const isRunnable = ["html", "css", "javascript", "js"].includes(language?.toLowerCase());
    const { theme } = useTheme();
    const currentTheme = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    const highlighterTheme = currentTheme === "dark" ? vscDarkPlus : oneLight;

    return (
        <div className={`relative group ${isMarkdown ? "my-4" : "mt-3 overflow-x-auto relative"}`}>
            <div className={`relative ${isMarkdown ? "max-w-full overflow-x-auto" : ""}`}>
                <SyntaxHighlighter
                    style={highlighterTheme}
                    language={language || "javascript"}
                    PreTag="div"
                    className={isMarkdown ? "rounded-[3px] max-w-full overflow-x-auto" : "rounded-[3px] !m-0 gum-border text-xs"}
                    customStyle={!isMarkdown ? { padding: "16px", background: "hsl(var(--muted))" } : undefined}
                    {...props}
                >
                    {!isMarkdown && isLongCode && !isExpanded ? truncatedCode : code}
                </SyntaxHighlighter>

                {isRunnable && (
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="absolute top-2 right-2 p-1.5 bg-primary/90 text-primary-foreground rounded-[3px] opacity-100 transition-opacity hover:bg-primary shadow-sm flex items-center gap-1.5 text-xs font-bold z-10"
                        title="Run Code"
                    >
                        <Play size={12} fill="currentColor" />
                        {showPreview ? "Close" : "Run"}
                    </button>
                )}
            </div>

            <LivePreviewModal code={code} language={language?.toLowerCase() || ""} isOpen={showPreview} onOpenChange={setShowPreview} />

            {!isMarkdown && isLongCode && (
                <button
                    onClick={onToggleExpand}
                    className="text-primary font-semibold mt-2 hover:underline focus:outline-none text-xs"
                >
                    {isExpanded ? 'See Less' : 'See More'}
                </button>
            )}
        </div>
    );
};
