import type { User } from "@supabase/supabase-js";

// Comma-separated list of admin emails in your .env file, e.g.:
// VITE_ADMIN_EMAILS=you@example.com,other@example.com
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const email = (user.email ?? "").toLowerCase();
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

