const ALLOWED_ORIGINS = [
  "https://genjutsu-social.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:4173",
];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin : "null",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Block requests from unknown origins
    if (!isAllowed) {
      return new Response("Forbidden", { status: 403 });
    }

    const url = new URL(request.url);

    if (url.pathname === "/config" && request.method === "GET") {
      // NOTE: Only app-bootstrap config is returned.
      // Secrets are protected behind the origin allowlist above.
      const config = {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        VITE_ABLY_KEY: env.VITE_ABLY_KEY,
        VITE_ADMIN_EMAILS: env.VITE_ADMIN_EMAILS,
        VITE_LANG_SERVICE: env.VITE_LANG_SERVICE,
        VITE_SENTRY_DSN: env.VITE_SENTRY_DSN,
        VITE_GROQ_API_KEY: env.VITE_GROQ_API_KEY,
      };

      return new Response(JSON.stringify(config), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
