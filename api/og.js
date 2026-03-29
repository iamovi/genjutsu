export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const APP_URL = 'https://genjutsu-social.vercel.app';

// Helper to prevent XSS in injected content
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const usernameParam = searchParams.get('username');
    const specialPage = searchParams.get('specialPage');

    if (!postId && !usernameParam && !specialPage) {
        return new Response('Missing target', { status: 400 });
    }

    try {
        let title = 'Genjutsu';
        let description = 'The 24 hour social network for developers.';
        let image = `${APP_URL}/fav.jpg`;
        let targetUrl = APP_URL;
        let bodyContent = '';

        // --- HANDLE POSTS ---
        if (postId) {
            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/posts?id=eq.${postId}&select=content,code,media_url,profiles(display_name,username,avatar_url)`,
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

            const displayName = post.profiles?.display_name || 'Someone';
            const username = post.profiles?.username || '';
            const avatarUrl = post.profiles?.avatar_url || '';

            title = `${displayName} on Genjutsu`;
            description = post.content
                ? (post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content)
                : 'View this post on Genjutsu.';
            image = post.media_url || avatarUrl || `${APP_URL}/fav.jpg`;
            targetUrl = `${APP_URL}/post/${postId}`;

            bodyContent = `
                <div id="ssr-content" style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:0 20px;">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                        ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(displayName)}" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" />` : ''}
                        <div>
                            <strong>${escapeHtml(displayName)}</strong>
                            <span style="color:#888;margin-left:6px;">@${escapeHtml(username)}</span>
                        </div>
                    </div>
                    <p style="font-size:16px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(post.content || '')}</p>
                    ${post.code ? `<pre style="background:#111;color:#eee;padding:16px;border-radius:6px;overflow:auto;font-size:13px;"><code>${escapeHtml(post.code)}</code></pre>` : ''}
                    ${post.media_url ? `<img src="${escapeHtml(post.media_url)}" alt="Post media" style="max-width:100%;border-radius:6px;margin-top:12px;" />` : ''}
                    <p style="color:#888;font-size:12px;margin-top:16px;">Posted on <a href="${APP_URL}">Genjutsu</a> — the 24 hour social network</p>
                </div>
            `;
        }
        // --- HANDLE PROFILES ---
        else if (usernameParam) {
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
                targetUrl = `${APP_URL}/u/${cleanUsername}`;
            } else {
                const displayName = profile.display_name || cleanUsername;
                title = `${displayName} (@${cleanUsername}) on Genjutsu`;
                description = profile.bio
                    ? (profile.bio.length > 160 ? profile.bio.substring(0, 160) + '...' : profile.bio)
                    : `Check out ${displayName}'s profile on Genjutsu, the 24-hour developer social network.`;
                image = profile.avatar_url || `${APP_URL}/fav.jpg`;
                targetUrl = `${APP_URL}/u/${cleanUsername}`;

                bodyContent = `
                    <div id="ssr-content" style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:0 20px;">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
                            ${profile.avatar_url ? `<img src="${escapeHtml(profile.avatar_url)}" alt="${escapeHtml(displayName)}" style="width:60px;height:60px;border-radius:4px;object-fit:cover;" />` : ''}
                            <div>
                                <h1 style="margin:0;font-size:20px;">${escapeHtml(displayName)}</h1>
                                <span style="color:#888;">@${escapeHtml(cleanUsername)}</span>
                            </div>
                        </div>
                        ${profile.bio ? `<p style="font-size:15px;line-height:1.6;">${escapeHtml(profile.bio)}</p>` : ''}
                        <p style="color:#888;font-size:12px;margin-top:16px;">View profile on <a href="${escapeHtml(targetUrl)}">Genjutsu</a></p>
                    </div>
                `;
            }
        }
        // --- HANDLE SPECIAL PAGES ---
        else if (specialPage === 'stranger') {
            title = 'Stranger Beta | genjutsu';
            description = 'Instantly match with random developers globally. 100% ephemeral, completely anonymous, lightning-fast WebSockets.';
            image = `${APP_URL}/og-image.png`;
            targetUrl = `${APP_URL}/stranger`;
            
            bodyContent = `
                <div id="ssr-content" style="font-family:sans-serif;max-width:680px;margin:40px auto;padding:0 20px;text-align:center;">
                    <h1>Stranger Beta</h1>
                    <p style="font-size:16px;line-height:1.6;">${escapeHtml(description)}</p>
                    <p style="color:#888;font-size:12px;margin-top:16px;">Access on <a href="${APP_URL}">Genjutsu</a></p>
                </div>
            `;
        }

        // --- INJECT INTO INDEX.HTML ---
        const indexRes = await fetch(`${APP_URL}/index.html`);
        let html = await indexRes.text();

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

        html = html.replace(/<title>.*?<\/title>/gi, '');
        html = html.replace(/<meta name="description".*?>/gi, '');
        html = html.replace(/<meta property="og:.*?".*?>/gi, '');
        html = html.replace(/<meta name="twitter:.*?".*?>/gi, '');
        html = html.replace('</head>', `${metaBlock}</head>`);
        html = html.replace('<div id="root"></div>', `${bodyContent}<div id="root"></div>`);

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
