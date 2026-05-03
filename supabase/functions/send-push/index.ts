/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck

// Supabase Edge Function: send-push
// Called by the DB trigger on notifications INSERT via pg_net
// Sends web push notifications using VAPID + RFC 8291 encryption

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// Web Push Helpers (VAPID + Encryption via Web Crypto API)
// =============================================================================

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const publicKeyBytes = base64UrlDecode(publicKeyB64);
  const privateKeyBytes = base64UrlDecode(privateKeyB64);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(publicKeyBytes.slice(1, 33)),
    y: base64UrlEncode(publicKeyBytes.slice(33, 65)),
    d: base64UrlEncode(privateKeyBytes),
  };

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  return { privateKey, publicKeyBytes };
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  const { privateKey, publicKeyBytes } = await importVapidKeys(vapidPublicKey, vapidPrivateKey);

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };

  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sigBytes = new Uint8Array(signature);
  const rawSig =
    sigBytes.length === 64
      ? sigBytes
      : (() => {
        let offset = 3;
        const rLen = sigBytes[offset++];
        const rRaw = sigBytes.slice(offset, offset + rLen);
        offset += rLen + 1;
        const sLen = sigBytes[offset++];
        const sRaw = sigBytes.slice(offset, offset + sLen);
        const r = new Uint8Array(32);
        const s = new Uint8Array(32);
        r.set(rRaw.length > 32 ? rRaw.slice(rRaw.length - 32) : rRaw, 32 - Math.min(rRaw.length, 32));
        s.set(sRaw.length > 32 ? sRaw.slice(sRaw.length - 32) : sRaw, 32 - Math.min(sRaw.length, 32));
        const out = new Uint8Array(64);
        out.set(r, 0);
        out.set(s, 32);
        return out;
      })();

  const token = `${unsignedToken}.${base64UrlEncode(rawSig)}`;

  return {
    authorization: `vapid t=${token}, k=${base64UrlEncode(publicKeyBytes)}`,
  };
}

async function encryptPayload(
  subscriptionKeys: { p256dh: string; auth: string },
  payloadText: string
): Promise<Uint8Array> {
  const p256dhBytes = base64UrlDecode(subscriptionKeys.p256dh);
  const authBytes = base64UrlDecode(subscriptionKeys.auth);
  const payloadBytes = new TextEncoder().encode(payloadText);

  const subscriberKey = await crypto.subtle.importKey(
    "raw",
    p256dhBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: subscriberKey },
      localKeyPair.privateKey,
      256
    )
  );

  const localPublicKeyBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  const prkHmacKey = await crypto.subtle.importKey(
    "raw",
    authBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prkHmacKey, sharedSecret));

  const keyInfoBuf = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...p256dhBytes,
    ...localPublicKeyBytes,
  ]);

  const ikmHmacKey = await crypto.subtle.importKey(
    "raw",
    prk,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const ikm = new Uint8Array(
    await crypto.subtle.sign("HMAC", ikmHmacKey, new Uint8Array([...keyInfoBuf, 1]))
  ).slice(0, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hkdfKey = await crypto.subtle.importKey("raw", ikm, { name: "HKDF" }, false, [
    "deriveBits",
  ]);

  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");

  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: cekInfo },
    hkdfKey,
    128
  );

  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info: nonceInfo },
    hkdfKey,
    96
  );

  const record = new Uint8Array(payloadBytes.length + 1);
  record.set(payloadBytes, 0);
  record[payloadBytes.length] = 2;

  const cek = await crypto.subtle.importKey("raw", cekBits, { name: "AES-GCM" }, false, [
    "encrypt",
  ]);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: new Uint8Array(nonceBits), tagLength: 128 },
    cek,
    record
  );

  const rs = 4096;
  const headerBuf = new Uint8Array(86);
  headerBuf.set(salt, 0);
  new DataView(headerBuf.buffer).setUint32(16, rs);
  headerBuf[20] = 65;
  headerBuf.set(localPublicKeyBytes, 21);

  const body = new Uint8Array(headerBuf.length + ciphertext.byteLength);
  body.set(headerBuf, 0);
  body.set(new Uint8Array(ciphertext), headerBuf.length);

  return body;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: Record<string, string>,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
) {
  const { authorization } = await createVapidAuthHeader(
    subscription.endpoint,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject
  );

  const encryptedBody = await encryptPayload(
    { p256dh: subscription.p256dh, auth: subscription.auth },
    JSON.stringify(payload)
  );

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: encryptedBody,
  });
}

// =============================================================================
// Edge Function Handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // No custom auth check needed — JWT verify is disabled in deployment
    // and this function is only called internally by the DB trigger via pg_net
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json();
    const userId = body.user_id;
    const notificationType = body.type;
    const actorId = body.actor_id;
    const postId = body.post_id;
    const messageContent = body.message_content || "";
    const hasMedia = Boolean(body.has_media);
    if (!userId) {
      return new Response(JSON.stringify({ error: "missing user_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get VAPID keys from env
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch push subscriptions using service role key
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build detailed notification message
    let notifBody = "You got a new notification — open app to see";
    let notifUrl = "https://genjutsu-social.vercel.app";
    let notifTag: string | undefined;

    if (actorId && notificationType) {
      // Look up actor's display name
      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", actorId)
        .single();

      const actorName = actorProfile?.display_name || "Someone";
      const actorUsername = actorProfile?.username;

      switch (notificationType) {
        case "like":
          notifBody = `${actorName} resonated with your post`;
          break;
        case "unlike":
          notifBody = `${actorName} stopped resonating with your post`;
          break;
        case "comment":
          notifBody = `${actorName} echoed on your post`;
          break;
        case "uncomment":
          notifBody = `${actorName} erased their echo on your post`;
          break;
        case "follow":
          notifBody = `${actorName} started following you`;
          break;
        case "unfollow":
          notifBody = `${actorName} stopped following you`;
          break;
        case "mention":
          notifBody = `${actorName} mentioned you in a void`;
          break;
        case "game_submission":
          notifBody = `${actorName} submitted a new game for review`;
          break;
        case "game_approved":
          notifBody = `${actorName} approved your game submission`;
          break;
        case "game_rejected":
          notifBody = `${actorName} rejected your game submission`;
          break;
        case "whisper": {
          const cleanMessage = String(messageContent).trim();
          const preview = cleanMessage.length > 100
            ? cleanMessage.slice(0, 100) + "..."
            : cleanMessage;
          notifBody = preview
            ? `${actorUsername || actorName}: ${preview}`
            : hasMedia
              ? `${actorName} sent you a photo`
              : `${actorName} sent you a whisper`;
          // Reuse one card for whispers from the same sender.
          if (actorId) {
            notifTag = `whisper-${actorId}`;
          } else if (actorUsername) {
            notifTag = `whisper-${actorUsername}`;
          } else {
            notifTag = "whisper";
          }
          break;
        }
      }

      // Set click URL based on notification type
      if (notificationType === "whisper") {
        if (actorUsername) {
          notifUrl = `https://genjutsu-social.vercel.app/whisper/${actorUsername}`;
        } else {
          notifUrl = `https://genjutsu-social.vercel.app/whispers`;
        }
      } else if (notificationType === "game_submission") {
        notifUrl = `https://genjutsu-social.vercel.app/admin`;
      } else if (notificationType === "game_approved") {
        notifUrl = `https://genjutsu-social.vercel.app/game-house`;
      } else if (notificationType === "game_rejected") {
        notifUrl = `https://genjutsu-social.vercel.app/game-house/submit`;
      } else if (notificationType === "follow" || notificationType === "unfollow") {
        if (actorUsername) {
          notifUrl = `https://genjutsu-social.vercel.app/u/${actorUsername}`;
        }
      } else if (postId) {
        notifUrl = `https://genjutsu-social.vercel.app/post/${postId}`;
      }
    }

    const pushPayload = {
      title: "genjutsu",
      body: notifBody,
      icon: "https://genjutsu-social.vercel.app/icon-192x192.png",
      url: notifUrl,
      tag: notifTag,
      renotify: true,
    };

    const vapidSubject = "mailto:genjutsu@proton.me";
    let sent = 0;
    let failed = 0;
    const staleEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushResponse = await sendWebPush(
          sub,
          pushPayload,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );
        if (pushResponse.status === 201 || pushResponse.status === 200) {
          sent++;
        } else if (pushResponse.status === 404 || pushResponse.status === 410) {
          staleEndpoints.push(sub.endpoint);
          failed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    // Clean up stale/expired subscriptions
    if (staleEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .in("endpoint", staleEndpoints);
    }

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
