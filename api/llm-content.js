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
  if (req.method === "OPTIONS") return jsonResponse({}, 200);
  if (req.method !== "GET") return jsonResponse({ error: "Method Not Allowed" }, 405);

  const payload = {
    name: "genjutsu",
    website: "https://genjutsu.xyz",
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
      home: "https://genjutsu.xyz/",
      about: "https://genjutsu.xyz/about",
      terms: "https://genjutsu.xyz/terms",
      privacy: "https://genjutsu.xyz/privacy",
      search: "https://genjutsu.xyz/search",
    },
    machine_readable: {
      llms_txt: "https://genjutsu.xyz/llms.txt",
      sitemap: "https://genjutsu.xyz/sitemap.xml",
    },
    updated_at: new Date().toISOString(),
  };

  return jsonResponse(payload);
}
