// Public feed API — Vercel Edge Function

export const config = { runtime: "edge" };

const APP_URL = "https://genjutsu-social.vercel.app";
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;
const DEFAULT_PAGE = 1;
const FEED_WINDOW_HOURS = 24;
// Bumped from 30s → 60s: halves DB hits from any polling clients
const LIVE_POLL_BUCKET_SECONDS = 60;
const DEFAULT_CACHE_CONTROL = "public, max-age=30, s-maxage=300, stale-while-revalidate=600";
// Bumped min-age from 5s → 10s so CDN absorbs more repeat requests
const LIVE_CACHE_CONTROL = "public, max-age=10, s-maxage=55, stale-while-revalidate=60";

let SUPABASE_URL = process.env.VITE_SUPABASE_URL;
let SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function jsonResponse(payload, status = 200, cacheControl = DEFAULT_CACHE_CONTROL) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "CDN-Cache-Control": cacheControl,
      "Vercel-CDN-Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function ensureSupabaseConfig() {
  if (SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY) return true;

  const workerUrl = process.env.VITE_CONFIG_WORKER_URL || "https://genjutsu-config.workers.dev/config";
  try {
    const configRes = await fetch(workerUrl, { headers: { Origin: APP_URL } });
    if (!configRes.ok) return false;
    const configData = await configRes.json();
    SUPABASE_URL = configData?.VITE_SUPABASE_URL;
    SUPABASE_PUBLISHABLE_KEY = configData?.VITE_SUPABASE_PUBLISHABLE_KEY;
    return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
  } catch {
    return false;
  }
}

function supabaseReadHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  };
}

function parsePositiveInt(input, fallback) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  if (!Number.isInteger(n) || n < 1) return fallback;
  return n;
}

function floorToPollBucket(date) {
  const bucketMs = LIVE_POLL_BUCKET_SECONDS * 1000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

function getServerTimeIso() {
  return floorToPollBucket(new Date()).toISOString();
}

function buildCutoffIso(sinceParam) {
  const defaultCutoff = new Date(Date.now() - FEED_WINDOW_HOURS * 60 * 60 * 1000);
  if (!sinceParam) return defaultCutoff.toISOString();
  const parsed = new Date(sinceParam);
  if (Number.isNaN(parsed.getTime())) return null;
  // Never allow older than the 24h retention window.
  return floorToPollBucket(parsed > defaultCutoff ? parsed : defaultCutoff).toISOString();
}

function getCacheControl({ page, hasSince }) {
  if (hasSince) return LIVE_CACHE_CONTROL;
  if (page <= 2) return DEFAULT_CACHE_CONTROL;
  return "public, max-age=30, s-maxage=120, stale-while-revalidate=300";
}

function aggregateCounts(rows = []) {
  const counts = Object.create(null);
  for (const row of rows) {
    const id = row?.post_id;
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

function normalizePost(post, likesCounts, commentsCounts) {
  const profileRaw = Array.isArray(post?.profiles) ? post.profiles[0] : post?.profiles;
  const profile = profileRaw || null;
  return {
    id: post.id,
    content: post.content || "",
    code: post.code || null,
    code_language: post.code_language || null,
    media_url: post.media_url || null,
    tags: Array.isArray(post.tags) ? post.tags : [],
    created_at: post.created_at,
    edited_at: post.edited_at || null,
    user_id: post.user_id,
    is_readme: Boolean(post.is_readme),
    views_count: Number(post.views_count || 0),
    likes_count: likesCounts[post.id] || 0,
    comments_count: commentsCounts[post.id] || 0,
    profile: profile
      ? {
          username: profile.username || "",
          display_name: profile.display_name || "",
          avatar_url: profile.avatar_url || null,
        }
      : null,
  };
}

/**
 * Fetches per-post counts from a given table.
 * Selects only the post_id column so Postgres reads minimal data from disk.
 * Returns null on fetch failure so caller can propagate a 502.
 */
async function fetchCountsForPosts(table, postIds) {
  if (!postIds.length) return Object.create(null);
  const inClause = `(${postIds.map((id) => JSON.stringify(String(id))).join(",")})`;
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.set("select", "post_id");
  url.searchParams.set("post_id", `in.${inClause}`);
  const res = await fetch(url.toString(), { headers: supabaseReadHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return aggregateCounts(Array.isArray(rows) ? rows : []);
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return jsonResponse({}, 200, "no-store");
  if (req.method !== "GET") return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405, "no-store");

  const hasConfig = await ensureSupabaseConfig();
  if (!hasConfig) {
    return jsonResponse({ ok: false, error: "Server configuration error" }, 500, "no-store");
  }

  const url = new URL(req.url);
  const rawLimit = parsePositiveInt(url.searchParams.get("limit"), DEFAULT_LIMIT);
  const rawPage = parsePositiveInt(url.searchParams.get("page"), DEFAULT_PAGE);
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const page = rawPage;
  const since = url.searchParams.get("since");
  const cutoffIso = buildCutoffIso(since);
  const serverTimeIso = getServerTimeIso();
  const cacheControl = getCacheControl({ page, hasSince: Boolean(since) });

  if (cutoffIso === null) {
    return jsonResponse({ ok: false, error: "Invalid `since` parameter. Use ISO date format." }, 400, "no-store");
  }

  const from = (page - 1) * limit;
  const postsSelect =
    "id,content,code,code_language,media_url,tags,created_at,edited_at,user_id,is_readme,views_count,profiles(username,display_name,avatar_url)";
  const postsUrl = new URL(`${SUPABASE_URL}/rest/v1/posts`);
  postsUrl.searchParams.set("select", postsSelect);
  postsUrl.searchParams.set("created_at", `gt.${cutoffIso}`);
  postsUrl.searchParams.set("order", "created_at.desc");
  postsUrl.searchParams.set("offset", String(from));
  postsUrl.searchParams.set("limit", String(limit + 1));

  try {
    const postsRes = await fetch(postsUrl.toString(), { headers: supabaseReadHeaders() });
    if (!postsRes.ok) {
      return jsonResponse({ ok: false, error: "Failed to fetch posts" }, 502, "no-store");
    }

    const postsData = await postsRes.json();
    const fetchedPosts = Array.isArray(postsData) ? postsData : [];
    const hasMore = fetchedPosts.length > limit;
    const pagePosts = hasMore ? fetchedPosts.slice(0, limit) : fetchedPosts;
    const postIds = pagePosts.map((p) => p.id).filter(Boolean);

    let likesCounts = Object.create(null);
    let commentsCounts = Object.create(null);

    if (postIds.length > 0) {
      // Run in parallel — each only reads the post_id column, minimizing disk IO
      const [likesResult, commentsResult] = await Promise.all([
        fetchCountsForPosts("likes", postIds),
        fetchCountsForPosts("comments", postIds),
      ]);

      if (likesResult === null || commentsResult === null) {
        return jsonResponse({ ok: false, error: "Failed to fetch feed counts" }, 502, "no-store");
      }

      likesCounts = likesResult;
      commentsCounts = commentsResult;
    }

    const posts = pagePosts.map((post) => normalizePost(post, likesCounts, commentsCounts));

    return jsonResponse({
      ok: true,
      meta: {
        page,
        limit,
        has_more: hasMore,
        since: since ? cutoffIso : null,
        window_hours: FEED_WINDOW_HOURS,
        server_time: serverTimeIso,
        poll_bucket_seconds: LIVE_POLL_BUCKET_SECONDS,
      },
      posts,
    }, 200, cacheControl);
  } catch {
    return jsonResponse({ ok: false, error: "Unexpected server error" }, 500, "no-store");
  }
}
