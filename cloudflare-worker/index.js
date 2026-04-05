const ALLOWED_ORIGINS = [
  "https://genjutsu-social.vercel.app",
];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    const corsHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
      // Keys are NOT included here anymore!
      const config = {
        VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        VITE_ADMIN_EMAILS: env.VITE_ADMIN_EMAILS,
        VITE_LANG_SERVICE: env.VITE_LANG_SERVICE,
        VITE_SENTRY_DSN: env.VITE_SENTRY_DSN,
      };

      return new Response(JSON.stringify(config), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    if (url.pathname === "/translate" && request.method === "POST") {
      try {
        const body = await request.json();
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.VITE_GROQ_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        
        const groqData = await groqResponse.json();
        return new Response(JSON.stringify(groqData), {
          status: groqResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/ably-auth" && request.method === "GET") {
      try {
        const clientId = url.searchParams.get('clientId') || 'anonymous';
        const keyName = env.VITE_ABLY_KEY.split(':')[0];
        
        const ablyResponse = await fetch(`https://rest.ably.io/keys/${keyName}/requestToken`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(env.VITE_ABLY_KEY)
          },
          body: JSON.stringify({ clientId: clientId })
        });

        const tokenRequest = await ablyResponse.json();
        return new Response(JSON.stringify(tokenRequest), {
          status: ablyResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
