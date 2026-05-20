export interface Config {
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_PUBLISHABLE_KEY: string;
  VITE_ADMIN_EMAILS: string;
  VITE_LANG_SERVICE: string;
  VITE_SENTRY_DSN: string;
  VITE_VAPID_PUBLIC_KEY?: string;
  VITE_GROQ_API_KEY?: string;
  VITE_ABLY_KEY?: string;
}

let config: Config | null = null;
let loadPromise: Promise<Config> | null = null;

export async function loadConfig(): Promise<Config> {
  if (config) return config;
  if (loadPromise) return loadPromise;

  loadPromise = Promise.resolve().then(() => {
    config = {
      VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || "",
      VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
      VITE_GROQ_API_KEY: import.meta.env.VITE_GROQ_API_KEY || "",
      VITE_ABLY_KEY: import.meta.env.VITE_ABLY_KEY || "",
      VITE_ADMIN_EMAILS: import.meta.env.VITE_ADMIN_EMAILS || "",
      VITE_LANG_SERVICE: import.meta.env.VITE_LANG_SERVICE || "",
      VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || "",
      VITE_VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY || "",
    };
    return config;
  });

  return loadPromise;
}

export function getConfig(): Config {
  if (!config) {
    throw new Error("Config not loaded. Call loadConfig() before getConfig().");
  }
  return config;
}
