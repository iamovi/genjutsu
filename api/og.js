export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const APP_URL = 'https://genjutsu-social.vercel.app'; // Production URL

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
        return new Response('Missing postId', { status: 400 });
    }

    try {
        // Fetch post from Supabase using REST API
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=content,media_url,profiles(display_name,username,avatar_url)`,
            {
                headers: {
                    apikey: SUPABASE_PUBLISHABLE_KEY,
                    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                },
            }
        );

        const data = await res.json();
        const post = data[0];

        if (!post) {
            return new Response('Post not found', { status: 404 });
        }

        const title = `${post.profiles?.display_name || 'Someone'} on Genjutsu`;
        const description = post.content ? (post.content.length > 160 ? post.content.substring(0, 160) + '...' : post.content) : 'View this post on Genjutsu.';
        const image = post.media_url || post.profiles?.avatar_url || `${APP_URL}/fav.jpg`;
        const postUrl = `${APP_URL}/post/${postId}`;

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${postUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${postUrl}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />

  <!-- Instant Redirect for bots/users that somehow execute this -->
  <meta http-equiv="refresh" content="0; url=${postUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${postUrl}">${postUrl}</a>...</p>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600' // Cache at Edge for 1hr
            },
        });

    } catch (error) {
        console.error("Error fetching post for OG tag generation:", error);
        return new Response('Failed to load preview', { status: 500 });
    }
}
