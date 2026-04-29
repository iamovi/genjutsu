const form = document.getElementById("playground-form");
const requestUrlEl = document.getElementById("request-url");
const responseBox = document.getElementById("response-box");
const baseUrlInput = document.getElementById("base-url");
const PROD_BASE_URL = "https://genjutsu-social.vercel.app";

if (typeof window !== "undefined") {
  const isHttp = window.location.protocol === "http:" || window.location.protocol === "https:";
  if (isHttp && baseUrlInput) {
    const host = window.location.hostname;
    const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
    baseUrlInput.value = isLocalHost ? PROD_BASE_URL : window.location.origin;
  }
}

function renderJson(data) {
  responseBox.textContent = JSON.stringify(data, null, 2);
}

function buildRequestUrl() {
  const baseUrl = (baseUrlInput.value || "").trim().replace(/\/+$/, "");
  const page = (document.getElementById("page").value || "1").trim();
  const since = (document.getElementById("since").value || "").trim();

  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("Base URL must start with http:// or https://");
  }

  const url = new URL("/api/genjutsu-feed", `${baseUrl}/`);
  url.searchParams.set("page", page);
  if (since) url.searchParams.set("since", since);
  return url;
}

async function fetchPreview(event) {
  event.preventDefault();
  let url;
  try {
    url = buildRequestUrl();
  } catch (error) {
    renderJson({
      ok: false,
      error: String(error.message || error),
    });
    return;
  }

  requestUrlEl.textContent = `GET ${url.toString()}`;
  responseBox.textContent = "Loading...";

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      // Common case: docs are opened locally, or branch deployment without the API route.
      // Retry against production API to make docs usable by default.
      const prodUrl = new URL("/api/genjutsu-feed", `${PROD_BASE_URL}/`);
      prodUrl.search = url.search;
      const retryRes = await fetch(prodUrl.toString(), { method: "GET" });
      const retryType = retryRes.headers.get("content-type") || "";
      if (!retryType.includes("application/json")) {
        throw new Error("Received non-JSON response. Check that this deployment includes /api/genjutsu-feed.");
      }
      const retryData = await retryRes.json();
      requestUrlEl.textContent = `GET ${prodUrl.toString()} (fallback from non-JSON response)`;
      renderJson(retryData);
      return;
    }
    const data = await res.json();
    renderJson(data);
  } catch (error) {
    renderJson({
      ok: false,
      error: "Network or CORS error while fetching API preview.",
      detail: String(error),
      hint: [
        "If you're testing locally, serve docs over http(s), not file://.",
        "If you're using production URL, deploy the branch that contains /api/genjutsu-feed first.",
      ],
    });
  }
}

form.addEventListener("submit", fetchPreview);

// ── Dark mode toggle ──
const toggle = document.getElementById('theme-toggle');
const moonIcon = toggle.querySelector('.moon-icon');
const sunIcon = toggle.querySelector('.sun-icon');

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    moonIcon.style.display = 'none';
    sunIcon.style.display = 'block';
  } else {
    moonIcon.style.display = 'block';
    sunIcon.style.display = 'none';
  }
}

const saved = localStorage.getItem('theme') || 'light';
applyTheme(saved);

toggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyTheme(next);
});