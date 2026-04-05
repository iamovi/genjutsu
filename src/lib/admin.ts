import type { User } from "@supabase/supabase-js";
import { getConfig } from "@/lib/config";

// Comma-separated list of admin emails in your .env file, e.g.:
// VITE_ADMIN_EMAILS=you@example.com,other@example.com
const getAdminEmails = () => (getConfig().VITE_ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminUser(user: User | null): boolean {
  if (!user) return false;
  const email = (user.email ?? "").toLowerCase();
  if (!email) return false;
  return getAdminEmails().includes(email);
}

