import { getControllerSettings } from "./_controller.js";

export default async function handler(req) {
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const settings = await getControllerSettings();
  return new Response(JSON.stringify({ ok: true, ...settings }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
