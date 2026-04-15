import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { extractFirstHttpUrl } from "@/lib/linkPreview";

interface LinkPreviewPayload {
  url: string;
  title: string;
  description: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

interface WhisperLinkPreviewProps {
  content: string;
  isMe: boolean;
}

function compactHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildFallbackPreview(url: string): LinkPreviewPayload {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return {
      url: parsed.toString(),
      title: host,
      description: `${host}${path}`,
      siteName: host,
      favicon: `${parsed.origin}/favicon.ico`,
    };
  } catch {
    return {
      url,
      title: url,
      description: url,
      siteName: url,
    };
  }
}

export default function WhisperLinkPreview({ content, isMe }: WhisperLinkPreviewProps) {
  const firstUrl = useMemo(() => extractFirstHttpUrl(content), [content]);

  const { data } = useQuery<LinkPreviewPayload | null>({
    queryKey: ["whisper-link-preview", firstUrl],
    enabled: Boolean(firstUrl),
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 1,
    queryFn: async () => {
      if (!firstUrl) return null;
      const encoded = encodeURIComponent(firstUrl);
      const localEndpoint = `/api/link-preview?url=${encoded}`;
      const prodEndpoint = `https://genjutsu-social.vercel.app/api/link-preview?url=${encoded}`;
      const endpoints = import.meta.env.DEV ? [localEndpoint, prodEndpoint] : [localEndpoint];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;

          const payload = await response.json();
          if (payload?.preview) return payload.preview as LinkPreviewPayload;
        } catch {
          // Try next endpoint
        }
      }

      // Show a minimal preview card even when metadata fetch fails.
      return buildFallbackPreview(firstUrl);
    },
  });

  if (!firstUrl || !data) return null;

  const host = compactHost(data.url || firstUrl);
  const title = data.title || host;
  const description = data.description || "";

  return (
    <a
      href={data.url || firstUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-2 block rounded-[3px] border overflow-hidden transition-colors ${
        isMe
          ? "border-primary-foreground/25 bg-primary-foreground/10 hover:bg-primary-foreground/15"
          : "border-border/80 bg-background/55 hover:bg-background/70"
      }`}
    >
      {data.image ? (
        <div className="w-full h-32 sm:h-36 bg-secondary/40">
          <img src={data.image} alt={title} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : null}

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          {data.favicon ? (
            <img src={data.favicon} alt="" className="w-3.5 h-3.5 rounded-[2px]" loading="lazy" />
          ) : null}
          <p className={`text-[10px] uppercase tracking-wide ${isMe ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
            {data.siteName || host}
          </p>
        </div>

        <p className={`text-xs font-semibold line-clamp-2 ${isMe ? "text-primary-foreground" : "text-foreground"}`}>
          {title}
        </p>

        {description ? (
          <p className={`text-[11px] mt-1 line-clamp-2 ${isMe ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {description}
          </p>
        ) : null}

        <div className={`mt-2 flex items-center gap-1 text-[10px] ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          <ExternalLink size={11} />
          <span className="truncate">{host}</span>
        </div>
      </div>
    </a>
  );
}
