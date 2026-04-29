import maintenanceConfig from "../maintenance.json" assert { type: "json" };
export const config = { runtime: "edge" };

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export default async function handler(req) {
  if (maintenanceConfig.enabled) {
    return new Response(JSON.stringify({ ok: false, error: "Service temporarily unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
  if (req.method === "OPTIONS") return jsonResponse({}, 200);
  if (req.method !== "GET") return jsonResponse({ error: "Method Not Allowed" }, 405);

  const payload = {
    name: "genjutsu",
    website: "https://genjutsu-social.vercel.app",
    summary:
      "Genjutsu is an ephemeral social platform for developers where posts and whispers expire after 24 hours.",
    features: [
      "Ephemeral feed posts",
      "Whispers (direct messages) with 24-hour expiration",
      "Community chat",
      "Profile pages, likes, comments, follows",
      "Push notifications for social and whisper events",
    ],
    routes: {
      home: "https://genjutsu-social.vercel.app/",
      about: "https://genjutsu-social.vercel.app/about",
      terms: "https://genjutsu-social.vercel.app/terms",
      privacy: "https://genjutsu-social.vercel.app/privacy",
      search: "https://genjutsu-social.vercel.app/search",
    },
    machine_readable: {
      llms_txt: "https://genjutsu-social.vercel.app/llms.txt",
      sitemap: "https://genjutsu-social.vercel.app/sitemap.xml",
    },
    updated_at: new Date().toISOString(),
  };

  return jsonResponse(payload);
}
