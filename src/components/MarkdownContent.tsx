import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkGemoji from "remark-gemoji";
import { CodeBlockWithPreview } from "./CodeBlockWithPreview";

interface MarkdownContentProps {
  content: string;
  isLongPost: boolean;
  isTextExpanded: boolean;
  onToggleExpand: () => void;
}

export default function MarkdownContent({ content, isLongPost, isTextExpanded, onToggleExpand }: MarkdownContentProps) {
  return (
    <div className="mt-3 p-4 rounded-[3px] gum-border bg-secondary/10 prose-readme">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkGemoji]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <CodeBlockWithPreview
                code={String(children).replace(/\n$/, "")}
                language={match[1]}
                isMarkdown={true}
                {...props}
              />
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {isLongPost && (
        <button
          onClick={onToggleExpand}
          className="text-primary font-semibold mt-2 hover:underline focus:outline-none text-sm"
        >
          {isTextExpanded ? 'See Less' : 'See More'}
        </button>
      )}
    </div>
  );
}
