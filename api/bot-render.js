import { getControllerSettings } from "./_controller.js";

const APP_URL = "https://genjutsu-social.vercel.app";
const CONFIG_WORKER_URL = process.env.VITE_CONFIG_WORKER_URL || "https://genjutsu-config.workers.dev/config";

let SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
let SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(value, max = 180) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 3).trimEnd() + "...";
}

function toISODate(value) {
  try {
    return new Date(value).toISOString();
  } catch {
    return "";
  }
}

function iso24hAgo() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function extractProfile(row) {
  if (!row) return null;
  if (Array.isArray(row.profiles)) return row.profiles[0] || null;
  return row.profiles || null;
}

async function ensureConfig() {
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) return true;

  try {
    const res = await fetch(CONFIG_WORKER_URL, {
      headers: { Origin: APP_URL },
    });
    if (!res.ok) return false;
    const json = await res.json();
    SUPABASE_URL = json?.VITE_SUPABASE_URL || "";
    SUPABASE_PUBLISHABLE_KEY = json?.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
  } catch {
    return false;
  }
}

async function supabaseFetch(pathAndQuery) {
  const ok = await ensureConfig();
  if (!ok) return { data: null, error: "config_missing" };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
    });
    if (!res.ok) {
      return { data: null, error: `supabase_${res.status}` };
    }
    const data = await res.json();
    return { data, error: null };
  } catch {
    return { data: null, error: "network_error" };
  }
}

function renderPage({
  title,
  description,
  canonical,
  body,
  image = `${APP_URL}/og-image.png`,
  noindex = false,
}) {
  const robots = noindex
    ? "noindex,nofollow,max-image-preview:large"
    : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="${robots}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
</head>
<body>
  <main style="max-width:760px;margin:2rem auto;padding:0 1rem;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;color:#111827;">
    ${body}
    <hr style="margin-top:2rem;border:none;border-top:1px solid #e5e7eb;" />
    <p style="font-size:12px;color:#6b7280;">Interactive app: <a href="${APP_URL}">${APP_URL}</a></p>
  </main>
</body>
</html>`;
}

function normalizeRoute(rawRoute) {
  const fallback = "/";
  if (!rawRoute) return fallback;
  let route = rawRoute;
  try {
    route = decodeURIComponent(rawRoute);
  } catch {
    route = rawRoute;
  }
  route = String(route).trim();
  if (!route.startsWith("/")) route = `/${route}`;
  route = route.split("#")[0].split("?")[0];
  if (!route) return fallback;
  return route;
}

async function renderHome() {
  const after = iso24hAgo();
  const params = new URLSearchParams({
    select: "id,content,created_at,profiles(display_name,username)",
    created_at: `gt.${after}`,
    order: "created_at.desc",
    limit: "10",
  });
  const { data } = await supabaseFetch(`posts?${params.toString()}`);
  const posts = Array.isArray(data) ? data : [];

  const list = posts.length
    ? `<ul>${posts
      .map((post) => {
        const p = extractProfile(post);
        const author = p?.display_name || p?.username || "Unknown";
        const username = p?.username || "";
        const content = truncate(post.content || "", 200);
        return `<li style="margin-bottom:1rem;">
  <article>
    <p style="font-size:14px;margin:0 0 4px 0;color:#6b7280;">${escapeHtml(author)}${username ? ` (@${escapeHtml(username)})` : ""}</p>
    <p style="margin:0 0 6px 0;">${escapeHtml(content || "(No text)")}</p>
    <a href="${APP_URL}/post/${escapeHtml(post.id)}">View post</a>
  </article>
</li>`;
      })
      .join("")}</ul>`
    : "<p>No recent public posts found at crawl time.</p>";

  return {
    status: 200,
    html: renderPage({
      title: "genjutsu - live developer feed",
      description: "Latest public posts on genjutsu, the 24-hour social network for developers.",
      canonical: `${APP_URL}/`,
      body: `<h1>genjutsu</h1>
<p>Live snapshot of recent public posts.</p>
${list}`,
    }),
  };
}

function renderStatic(route) {
  const pages = {
    "/about": {
      title: "About genjutsu",
      description: "About genjutsu, an ephemeral social network for developers.",
      body: "<h1>About genjutsu</h1><p>Genjutsu is designed for low-pressure developer sharing where posts and chats vanish after 24 hours.</p>",
    },
    "/terms": {
      title: "genjutsu Terms",
      description: "Terms of participation for genjutsu.",
      body: "<h1>Terms</h1><p>Read the full terms in the interactive app for legal and policy details.</p>",
    },
    "/privacy": {
      title: "genjutsu Privacy",
      description: "Privacy details and ephemeral data lifecycle for genjutsu.",
      body: "<h1>Privacy</h1><p>Genjutsu applies a 24-hour expiration model to key user-generated content types.</p>",
    },
    "/search": {
      title: "Search on genjutsu",
      description: "Search users and public content on genjutsu.",
      body: "<h1>Search</h1><p>Use search in the interactive app to discover users and active content.</p>",
    },
  };

  const page = pages[route];
  if (!page) return null;

  return {
    status: 200,
    html: renderPage({
      title: page.title,
      description: page.description,
      canonical: `${APP_URL}${route}`,
      body: page.body,
    }),
  };
}

async function renderProfile(route) {
  const username = route.replace(/^\/u\//, "").split("/")[0].trim();
  if (!username) {
    return {
      status: 404,
      html: renderPage({
        title: "Profile not found",
        description: "Requested profile route is invalid.",
        canonical: `${APP_URL}${route}`,
        body: "<h1>Profile not found</h1>",
        noindex: true,
      }),
    };
  }

  const pParams = new URLSearchParams({
    select: "user_id,username,display_name,bio,avatar_url",
    username: `eq.${username}`,
    limit: "1",
  });
  const { data } = await supabaseFetch(`profiles?${pParams.toString()}`);
  const profile = Array.isArray(data) ? data[0] : null;
  if (!profile) {
    return {
      status: 404,
      html: renderPage({
        title: "Profile not found",
        description: "This profile does not exist.",
        canonical: `${APP_URL}/u/${encodeURIComponent(username)}`,
        body: "<h1>Profile not found</h1>",
        noindex: true,
      }),
    };
  }

  const after = iso24hAgo();
  const postsParams = new URLSearchParams({
    select: "id,content,created_at",
    user_id: `eq.${profile.user_id}`,
    created_at: `gt.${after}`,
    order: "created_at.desc",
    limit: "8",
  });
  const { data: postsData } = await supabaseFetch(`posts?${postsParams.toString()}`);
  const posts = Array.isArray(postsData) ? postsData : [];

  const postsHtml = posts.length
    ? `<h2>Recent posts</h2><ul>${posts
      .map(
        (post) => `<li style="margin-bottom:0.75rem;">
  <a href="${APP_URL}/post/${escapeHtml(post.id)}">${escapeHtml(truncate(post.content || "(No text)", 150))}</a>
</li>`
      )
      .join("")}</ul>`
    : "<p>No recent posts found for this user at crawl time.</p>";

  return {
    status: 200,
    html: renderPage({
      title: `${profile.display_name || profile.username} (@${profile.username}) - genjutsu`,
      description: truncate(profile.bio || `Profile of @${profile.username} on genjutsu.`, 180),
      canonical: `${APP_URL}/u/${encodeURIComponent(profile.username)}`,
      image: profile.avatar_url || `${APP_URL}/og-image.png`,
      body: `<h1>${escapeHtml(profile.display_name || profile.username)}</h1>
<p>@${escapeHtml(profile.username)}</p>
${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ""}
${postsHtml}`,
    }),
  };
}

async function renderPost(route) {
  const postId = route.replace(/^\/post\//, "").split("/")[0].trim();
  if (!postId) {
    return {
      status: 404,
      html: renderPage({
        title: "Post not found",
        description: "Requested post route is invalid.",
        canonical: `${APP_URL}${route}`,
        body: "<h1>Post not found</h1>",
        noindex: true,
      }),
    };
  }

  const after = iso24hAgo();
  const params = new URLSearchParams({
    select: "id,content,created_at,media_url,profiles(display_name,username,avatar_url)",
    id: `eq.${postId}`,
    created_at: `gt.${after}`,
    limit: "1",
  });

  const { data } = await supabaseFetch(`posts?${params.toString()}`);
  const post = Array.isArray(data) ? data[0] : null;
  if (!post) {
    return {
      status: 404,
      html: renderPage({
        title: "Post not found",
        description: "This post may have expired or does not exist.",
        canonical: `${APP_URL}/post/${encodeURIComponent(postId)}`,
        body: "<h1>Post not found</h1><p>This post may have expired (genjutsu posts are ephemeral).</p>",
        noindex: true,
      }),
    };
  }

  const profile = extractProfile(post) || {};
  const author = profile.display_name || profile.username || "Unknown";
  const description = truncate(post.content || `Post from ${author} on genjutsu.`, 180);
  const image = post.media_url || profile.avatar_url || `${APP_URL}/og-image.png`;

  return {
    status: 200,
    html: renderPage({
      title: `${author} on genjutsu`,
      description,
      canonical: `${APP_URL}/post/${encodeURIComponent(post.id)}`,
      image,
      body: `<article>
  <h1>${escapeHtml(author)}${profile.username ? ` (@${escapeHtml(profile.username)})` : ""}</h1>
  <p style="font-size:13px;color:#6b7280;">${escapeHtml(toISODate(post.created_at))}</p>
  <p>${escapeHtml(post.content || "(No text)")}</p>
  ${post.media_url ? `<p><img src="${escapeHtml(post.media_url)}" alt="Post media" style="max-width:100%;height:auto;border-radius:8px;" /></p>` : ""}
</article>`,
    }),
  };
}

export default async function handler(req) {
  const controller = await getControllerSettings();
  if (controller.apiOff || controller.botRenderApiOff) {
    return new Response("API is temporarily disabled", { status: 503 });
  }

  const reqUrl = new URL(req.url);
  const route = normalizeRoute(reqUrl.searchParams.get("route") || "/");

  let result;
  if (route === "/") {
    result = await renderHome();
  } else if (route.startsWith("/u/")) {
    result = await renderProfile(route);
  } else if (route.startsWith("/post/")) {
    result = await renderPost(route);
  } else {
    result = renderStatic(route);
  }

  if (!result) {
    result = {
      status: 404,
      html: renderPage({
        title: "Page not found",
        description: "The requested route is not available.",
        canonical: `${APP_URL}${route}`,
        body: "<h1>Page not found</h1>",
        noindex: true,
      }),
    };
  }

  return new Response(result.html, {
    status: result.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=120, stale-while-revalidate=600",
      Vary: "User-Agent",
    },
  });
}
