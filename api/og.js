export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const APP_URL = 'https://genjutsu-social.vercel.app'; // Production URL

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const usernameParam = searchParams.get('username');

    // If neither is provided, fail early
    if (!postId && !usernameParam) {
        return new Response('Missing target', { status: 400 });
    }

    try {
        let title = 'Genjutsu';
        let description = 'The 24 hour social network for developers.';
        let image = `${APP_URL}/fav.jpg`;
        let targetUrl = APP_URL;

        // --- HANDLE POSTS ---
        if (postId) {
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

            title = `${post.profiles?.display_name || 'Someone'} on Genjutsu`;

            // Better text extraction, removing markdown hashtags/codeblocks visually if short
            description = post.content ? (post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content) : 'View this post on Genjutsu.';

            image = post.media_url || post.profiles?.avatar_url || `${APP_URL}/fav.jpg`;
            targetUrl = `${APP_URL}/post/${postId}`;
        }
        // --- HANDLE PROFILES ---
        else if (usernameParam) {
            // Decode URL encoding in case it exists (e.g. %40username) and strip leading @ if present
            const cleanUsername = usernameParam.replace(/^@/, '');

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?username=eq.${cleanUsername}&select=display_name,avatar_url,bio`,
                {
                    headers: {
                        apikey: SUPABASE_PUBLISHABLE_KEY,
                        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
                    },
                }
            );

            const data = await res.json();
            const profile = data[0];

            if (!profile) {
                // Fallback gracefully to default if no user found but still give the URL
                targetUrl = `${APP_URL}/${cleanUsername}`;
            } else {
                const displayName = profile.display_name || cleanUsername;
                title = `${displayName} (@${cleanUsername}) on Genjutsu`;
                description = profile.bio ? (profile.bio.length > 160 ? profile.bio.substring(0, 160) + '...' : profile.bio) : `Check out ${displayName}'s profile on Genjutsu, the 24-hour developer social network.`;
                image = profile.avatar_url || `${APP_URL}/fav.jpg`;
                targetUrl = `${APP_URL}/${cleanUsername}`;
            }
        }

        // --- INJECT INTO INDEX.HTML ---
        const indexRes = await fetch(`${APP_URL}/index.html`);
        let html = await indexRes.text();

        // Prepare the meta tags block
        const metaBlock = `
  <title>${title}</title>
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${targetUrl}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
`;

        // We clean ALL existing static SEO/OG/Twitter tags to avoid duplicates
        // which can confuse some crawlers (like Discord/Telegram).
        html = html.replace(/<title>.*?<\/title>/gi, '');
        html = html.replace(/<meta name="description".*?>/gi, '');
        html = html.replace(/<meta property="og:.*?".*?>/gi, '');
        html = html.replace(/<meta name="twitter:.*?".*?>/gi, '');

        // Inject our fresh dynamic block into the head
        html = html.replace('</head>', `${metaBlock}</head>`);

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600'
            },
        });

    } catch (error) {
        console.error("Error fetching data for OG tag generation:", error);
        return new Response('Failed to load preview', { status: 500 });
    }
}
