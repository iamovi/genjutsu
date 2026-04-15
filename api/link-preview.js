export const config = { runtime: "edge" };

const REQUEST_TIMEOUT_MS = 7000;

const ENTITY_MAP = {
  "&amp;": "&",
  "&quot;": "\"",
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

function decodeEntities(input = "") {
  return String(input).replace(/&amp;|&quot;|&#39;|&lt;|&gt;/g, (m) => ENTITY_MAP[m] || m).trim();
}

function escapeRegex(input = "") {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readMetaBy(html, attr, key) {
  const escapedKey = escapeRegex(key);
  const patterns = [
    new RegExp(`<meta[^>]*${attr}\\s*=\\s*["']${escapedKey}["'][^>]*content\\s*=\\s*["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]*content\\s*=\\s*["']([^"']+)["'][^>]*${attr}\\s*=\\s*["']${escapedKey}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return "";
}

function readTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeEntities(match[1]) : "";
}

function readFavicon(html) {
  const pattern =
    /<link[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i;
  const fallbackPattern =
    /<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i;
  const match = html.match(pattern) || html.match(fallbackPattern);
  return match?.[1] ? decodeEntities(match[1]) : "";
}

function makeAbsoluteUrl(baseUrl, maybeRelative) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return "";
  }
}

function normalizeHost(hostname = "") {
  return hostname.trim().toLowerCase();
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isBlockedHost(hostname = "") {
  const host = normalizeHost(hostname);
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host === "::1") return true;
  if (host.includes(":")) {
    const compact = host.replace(/[\[\]]/g, "").toLowerCase();
    if (compact === "::1" || compact.startsWith("fc") || compact.startsWith("fd") || compact.startsWith("fe80")) {
      return true;
    }
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isPrivateIpv4(host)) return true;
  return false;
}

function buildFallback(urlObj, overrides = {}) {
  const host = urlObj.hostname.replace(/^www\./, "");
  const path = urlObj.pathname === "/" ? "" : urlObj.pathname;
  return {
    url: urlObj.toString(),
    title: overrides.title || host,
    description: overrides.description || `${host}${path}`,
    image: overrides.image || "",
    siteName: overrides.siteName || host,
    favicon: overrides.favicon || `${urlObj.origin}/favicon.ico`,
  };
}

function jsonResponse(payload, status = 200, cacheControl = "public, max-age=1800, s-maxage=1800") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return jsonResponse({}, 200, "no-store");
  }

  const reqUrl = new URL(req.url);
  const target = reqUrl.searchParams.get("url");

  if (!target) {
    return jsonResponse({ error: "Missing url parameter" }, 400, "no-store");
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return jsonResponse({ error: "Invalid URL" }, 400, "no-store");
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return jsonResponse({ error: "Only HTTP(S) URLs are supported" }, 400, "no-store");
  }

  if (isBlockedHost(targetUrl.hostname)) {
    return jsonResponse({ error: "Blocked host" }, 400, "no-store");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), REQUEST_TIMEOUT_MS);

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: abortController.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; GenjutsuLinkPreview/1.0; +https://genjutsu-social.vercel.app)",
        accept: "text/html,application/xhtml+xml,image/*,*/*;q=0.8",
      },
    });

    const finalUrl = new URL(upstream.url || targetUrl.toString());
    if (isBlockedHost(finalUrl.hostname)) {
      return jsonResponse({ error: "Blocked redirect host" }, 400, "no-store");
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.startsWith("image/")) {
      const fallback = buildFallback(finalUrl, { image: finalUrl.toString() });
      return jsonResponse({ preview: fallback });
    }

    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return jsonResponse({ preview: buildFallback(finalUrl) });
    }

    const html = (await upstream.text()).slice(0, 350_000);

    const title =
      readMetaBy(html, "property", "og:title") ||
      readMetaBy(html, "name", "twitter:title") ||
      readTitle(html);

    const description =
      readMetaBy(html, "property", "og:description") ||
      readMetaBy(html, "name", "twitter:description") ||
      readMetaBy(html, "name", "description");

    const image =
      readMetaBy(html, "property", "og:image") ||
      readMetaBy(html, "property", "og:image:url") ||
      readMetaBy(html, "name", "twitter:image");

    const siteName = readMetaBy(html, "property", "og:site_name");
    const favicon = readFavicon(html);

    const preview = buildFallback(finalUrl, {
      title: title || undefined,
      description: description || undefined,
      image: makeAbsoluteUrl(finalUrl, image),
      siteName: siteName || undefined,
      favicon: makeAbsoluteUrl(finalUrl, favicon),
    });

    return jsonResponse({ preview });
  } catch {
    return jsonResponse({ preview: buildFallback(targetUrl) });
  } finally {
    clearTimeout(timeout);
  }
}
